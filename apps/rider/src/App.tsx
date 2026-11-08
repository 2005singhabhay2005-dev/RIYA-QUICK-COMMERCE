
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bike, Package, MapPin, Phone, LogOut, RefreshCw, Search,
  Clock3, CheckCircle2, Truck, Navigation, IndianRupee,
  UserRound, ChevronRight, X, Menu, AlertCircle, LoaderCircle,
  Radio, RadioTower, LocateFixed, Wifi, WifiOff
} from "lucide-react";

const API = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/$/, "");
const TOKEN_KEY = "riya-rider-token";
const PROFILE_KEY = "riya-rider-profile";

type AnyRecord = Record<string, any>;

type GPSLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  recorded_at?: string;
};

function readToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

function getMessage(data: AnyRecord, fallback: string) {
  return data?.message || data?.error || fallback;
}

function getList(data: AnyRecord): AnyRecord[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.orders)) return data.orders;
  if (Array.isArray(data?.data?.orders)) return data.data.orders;
  return [];
}

function money(value: any) {
  const number = Number(value || 0);
  return number.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  });
}

function orderId(order: AnyRecord) {
  return order?.id ?? order?.order_id ?? order?._id ?? "—";
}

function customerName(order: AnyRecord) {
  return order?.customer_name || order?.customer?.name ||
    order?.shipping_name || order?.name || "Customer";
}

function customerPhone(order: AnyRecord) {
  return order?.customer_phone || order?.customer?.phone ||
    order?.phone || order?.shipping_phone || "";
}

function addressOf(order: AnyRecord) {
  const a = order?.shipping_address || order?.delivery_address ||
    order?.address || order?.customer?.address;

  if (typeof a === "string") return a;

  if (a && typeof a === "object") {
    return [
      a.address_line1, a.address_line2, a.address,
      a.landmark, a.city, a.state, a.pincode, a.postal_code
    ].filter(Boolean).join(", ");
  }

  return [
    order?.address_line1, order?.city,
    order?.state, order?.pincode
  ].filter(Boolean).join(", ");
}

function statusOf(order: AnyRecord) {
  return order?.status || order?.order_status || "Assigned";
}

function amountOf(order: AnyRecord) {
  return order?.total_amount ?? order?.total ??
    order?.grand_total ?? order?.amount ?? 0;
}

function itemsOf(order: AnyRecord): AnyRecord[] {
  return Array.isArray(order?.items)
    ? order.items
    : Array.isArray(order?.order_items)
      ? order.order_items
      : [];
}

async function request(path: string, options: RequestInit = {}) {
  const token = readToken();

  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(PROFILE_KEY);
      window.dispatchEvent(new Event("rider-session-expired"));
    }

    throw new Error(getMessage(data, `Request failed (${response.status})`));
  }

  return data;
}

export default function App() {
  const [token, setToken] = useState(readToken());

  const [profile, setProfile] = useState<AnyRecord>(() => {
    try {
      return JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");
    } catch {
      return {};
    }
  });

  const [orders, setOrders] = useState<AnyRecord[]>([]);
  const [selected, setSelected] = useState<AnyRecord | null>(null);
  const [detail, setDetail] = useState<AnyRecord | null>(null);

  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [delivering, setDelivering] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);

  // GPS state
  const [isOnline, setIsOnline] = useState(false);
  const [gpsLocation, setGpsLocation] = useState<GPSLocation | null>(null);
  const [gpsMessage, setGpsMessage] = useState("GPS not started");
  const [gpsError, setGpsError] = useState("");
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsPermission, setGpsPermission] = useState("unknown");

  const watchIdRef = useRef<number | null>(null);
  const lastGpsSentRef = useRef(0);
  const gpsMountedRef = useRef(true);

  const activeDelivery = useMemo(
    () => orders.find(order => statusOf(order) === "Out for Delivery") || null,
    [orders]
  );

  const hasActiveDelivery = Boolean(activeDelivery);

  const stopGPSWatch = useCallback(() => {
    if (
      watchIdRef.current !== null &&
      "geolocation" in navigator
    ) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = null;
  }, []);

  const logout = useCallback(() => {
    // Best-effort server-side offline update.
    if (readToken()) {
      request("/rider/gps/presence", {
        method: "PATCH",
        body: JSON.stringify({ online: false })
      }).catch(() => {});
    }

    stopGPSWatch();

    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(PROFILE_KEY);

    setToken("");
    setProfile({});
    setOrders([]);
    setSelected(null);
    setDetail(null);

    setIsOnline(false);
    setGpsLocation(null);
    setGpsMessage("GPS stopped");
    setGpsError("");
  }, [stopGPSWatch]);

  const loadOrders = useCallback(async () => {
    if (!readToken()) return;

    setLoading(true);
    setError("");

    try {
      const data = await request("/rider/orders");
      setOrders(getList(data));
    } catch (e: any) {
      setError(e.message || "Orders load nahi ho sake.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadGPSStatus = useCallback(async () => {
    if (!readToken()) return;

    try {
      const result = await request("/rider/gps/status");
      const data = result?.data || {};

      const online = Boolean(data?.presence?.is_online);
      setIsOnline(online);

      if (data?.location) {
        setGpsLocation({
          latitude: Number(data.location.latitude),
          longitude: Number(data.location.longitude),
          accuracy: data.location.accuracy ?? null,
          heading: data.location.heading ?? null,
          speed: data.location.speed ?? null,
          recorded_at: data.location.recorded_at
        });
      }

      setGpsMessage(
        online ? "Rider availability is online" : "You are offline"
      );
    } catch (e: any) {
      setGpsError(e.message || "GPS status load nahi hua.");
    }
  }, []);

  const verifySession = useCallback(async () => {
    if (!readToken()) return;

    try {
      const data = await request("/rider/auth/me");

      const rider = data?.data?.rider ||
        data?.rider ||
        data?.data ||
        data?.user ||
        data;

      setProfile(rider);
      localStorage.setItem(PROFILE_KEY, JSON.stringify(rider));

      await Promise.all([
        loadOrders(),
        loadGPSStatus()
      ]);
    } catch {
      logout();
    }
  }, [loadOrders, loadGPSStatus, logout]);

  useEffect(() => {
    if (token) verifySession();
  }, [token, verifySession]);

  useEffect(() => {
    const expired = () => logout();

    window.addEventListener("rider-session-expired", expired);

    return () => {
      window.removeEventListener("rider-session-expired", expired);
    };
  }, [logout]);

  // Clean up GPS watcher on component unmount.
  useEffect(() => {
    gpsMountedRef.current = true;

    return () => {
      gpsMountedRef.current = false;
      stopGPSWatch();
    };
  }, [stopGPSWatch]);

  // GPS sharing is enabled only when:
  // 1. Rider is authenticated.
  // 2. Rider has enabled Online.
  // 3. At least one active Out for Delivery order exists.
  useEffect(() => {
    stopGPSWatch();

    if (!token || !isOnline) return;

    if (!hasActiveDelivery) {
      setGpsMessage("Online — waiting for an active delivery");
      return;
    }

    if (!navigator.geolocation) {
      setGpsError("This browser does not support GPS location.");
      setGpsMessage("GPS unavailable");
      return;
    }

    setGpsError("");
    setGpsMessage("Requesting location permission...");

    let lastSent = 0;

    const watchId = navigator.geolocation.watchPosition(
      async position => {
        const coords = position.coords;

        const current: GPSLocation = {
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy ?? null,
          heading: coords.heading ?? null,
          speed: coords.speed ?? null,
          recorded_at: new Date().toISOString()
        };

        if (!gpsMountedRef.current) return;

        setGpsLocation(current);
        setGpsPermission("granted");
        setGpsMessage("GPS location detected");
        setGpsError("");

        // Prevent excessive requests. Server also throttles updates.
        const now = Date.now();

        if (now - lastSent < 4000) return;

        lastSent = now;
        lastGpsSentRef.current = now;

        try {
          await request("/rider/gps/location", {
            method: "POST",
            body: JSON.stringify({
              latitude: current.latitude,
              longitude: current.longitude,
              accuracy: current.accuracy,
              heading: current.heading,
              speed: current.speed
            })
          });

          if (gpsMountedRef.current) {
            setGpsMessage("Live GPS sharing active");
          }
        } catch (e: any) {
          if (gpsMountedRef.current) {
            setGpsError(e.message || "GPS update failed");
            setGpsMessage("GPS update failed");
          }
        }
      },
      gpsFailure => {
        if (!gpsMountedRef.current) return;

        let message = "Unable to access GPS location.";

        if (gpsFailure.code === 1) {
          message = "Location permission denied. Allow location access in browser settings.";
          setGpsPermission("denied");
        } else if (gpsFailure.code === 2) {
          message = "Your device location is unavailable. Check GPS settings.";
        } else if (gpsFailure.code === 3) {
          message = "GPS request timed out. Trying again...";
        }

        setGpsError(message);
        setGpsMessage("GPS unavailable");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 20000
      }
    );

    watchIdRef.current = watchId;

    return () => {
      navigator.geolocation.clearWatch(watchId);
      watchIdRef.current = null;
    };
  }, [token, isOnline, hasActiveDelivery, stopGPSWatch]);

  async function toggleAvailability() {
    if (gpsBusy) return;

    setGpsBusy(true);
    setGpsError("");

    try {
      const nextOnline = !isOnline;

      if (nextOnline && !navigator.geolocation) {
        throw new Error("This browser does not support GPS.");
      }

      const result = await request("/rider/gps/presence", {
        method: "PATCH",
        body: JSON.stringify({ online: nextOnline })
      });

      setIsOnline(nextOnline);
      setGpsMessage(
        nextOnline
          ? "You are online"
          : "You are offline"
      );

      setNotice(
        result?.message ||
        (nextOnline ? "You are now online." : "You are now offline.")
      );

      if (!nextOnline) {
        stopGPSWatch();
        setGpsError("");
      } else if (!hasActiveDelivery) {
        setGpsMessage("Online — waiting for an active delivery");
      }
    } catch (e: any) {
      setGpsError(e.message || "Availability update failed.");
    } finally {
      setGpsBusy(false);
    }
  }

  async function login(event: React.FormEvent) {
    event.preventDefault();

    setLoginLoading(true);
    setError("");

    try {
      const response = await fetch(`${API}/rider/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: loginId.trim(),
          password
        })
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(getMessage(result, "Login failed"));
      }

      const newToken =
        result?.token ||
        result?.data?.token ||
        result?.access_token;

      const rider =
        result?.rider ||
        result?.data?.rider ||
        result?.data?.user ||
        result?.data;

      if (!newToken) {
        throw new Error(
          "Login response mein token nahi mila. API response verify karein."
        );
      }

      localStorage.setItem(TOKEN_KEY, newToken);
      localStorage.setItem(PROFILE_KEY, JSON.stringify(rider || {}));

      setProfile(rider || {});
      setToken(newToken);
      setPassword("");

      setNotice("Login successful. Welcome!");
    } catch (e: any) {
      setError(e.message || "Login nahi ho saka.");
    } finally {
      setLoginLoading(false);
    }
  }

  async function openOrder(order: AnyRecord) {
    setSelected(order);
    setDetail(null);

    try {
      const result = await request(
        `/rider/orders/${encodeURIComponent(orderId(order))}`
      );

      setDetail(
        result?.data?.order ||
        result?.order ||
        result?.data ||
        result
      );
    } catch (e: any) {
      setDetail(order);
      setError(e.message || "Order details load nahi hue.");
    }
  }

  async function markDelivered() {
    if (!selected) return;

    if (statusOf(detail || selected) !== "Out for Delivery") {
      setError("Sirf Out for Delivery order Delivered mark ho sakta hai.");
      return;
    }

    if (
      !window.confirm(
        `Order #${orderId(selected)} ko Delivered mark karna hai?`
      )
    ) return;

    setDelivering(true);
    setError("");

    try {
      await request(
        `/rider/orders/${encodeURIComponent(orderId(selected))}/delivered`,
        { method: "PATCH" }
      );

      setNotice(`Order #${orderId(selected)} delivered successfully.`);
      setSelected(null);
      setDetail(null);

      await loadOrders();
    } catch (e: any) {
      setError(e.message || "Delivery update failed.");
    } finally {
      setDelivering(false);
    }
  }

  const stats = useMemo(() => ({
    total: orders.length,
    active: orders.filter(
      o => statusOf(o) === "Out for Delivery"
    ).length,
    delivered: orders.filter(
      o => statusOf(o) === "Delivered"
    ).length,
    ready: orders.filter(
      o => statusOf(o) === "Ready for Dispatch"
    ).length
  }), [orders]);

  const visibleOrders = useMemo(() => orders.filter(order => {
    const status = statusOf(order);

    const matchesFilter =
      filter === "All" ||
      (filter === "Active" && status === "Out for Delivery") ||
      (filter === "Delivered" && status === "Delivered") ||
      (
        filter === "Other" &&
        status !== "Out for Delivery" &&
        status !== "Delivered"
      );

    const query = search.toLowerCase();

    const matchesSearch =
      !query ||
      String(orderId(order)).toLowerCase().includes(query) ||
      customerName(order).toLowerCase().includes(query) ||
      addressOf(order).toLowerCase().includes(query);

    return matchesFilter && matchesSearch;
  }), [orders, filter, search]);

  if (!token) {
    return (
      <main className="login-screen">
        <section className="login-art">
          <div className="brand">
            <span className="brand-icon"><Bike /></span>
            <span>RIYA <b>RIDER</b></span>
          </div>

          <div className="art-copy">
            <span className="eyebrow">DELIVERY PARTNER PORTAL</span>
            <h1>Every delivery.<br /><em>Every smile.</em></h1>
            <p>
              Your delivery dashboard. Your assigned orders.
              One simple place to manage every doorstep delivery.
            </p>
            <div className="art-stats">
              <div><strong>01</strong><span>Receive orders</span></div>
              <div><strong>02</strong><span>Navigate</span></div>
              <div><strong>03</strong><span>Deliver</span></div>
            </div>
          </div>

          <div className="art-footer">
            RIYA SOLAR · QUICK COMMERCE
          </div>
        </section>

        <section className="login-panel">
          <form className="login-card" onSubmit={login}>
            <div className="mobile-brand"><Bike /> RIYA RIDER</div>

            <span className="eyebrow">RIDER ACCOUNT</span>
            <h2>Welcome back</h2>
            <p className="muted">
              Sign in to view and manage your deliveries.
            </p>

            {error && (
              <div className="alert error">
                <AlertCircle size={17} />{error}
              </div>
            )}

            <label>Phone number or email</label>
            <input
              value={loginId}
              onChange={e => setLoginId(e.target.value)}
              placeholder="Enter phone or email"
              required
              autoComplete="username"
            />

            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              autoComplete="current-password"
            />

            <button className="primary login-button" disabled={loginLoading}>
              {loginLoading
                ? <LoaderCircle className="spin" />
                : <Bike size={19} />}
              Sign in to Rider App
            </button>

            <p className="login-help">
              Use the rider account created by your Riya Solar administrator.
            </p>
          </form>
        </section>
      </main>
    );
  }

  const current = detail || selected || {};
  const address = current ? addressOf(current) : "";
  const phone = current ? customerPhone(current) : "";
  const items = current ? itemsOf(current) : [];

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "open" : ""}`}>
        <div className="brand">
          <span className="brand-icon"><Bike /></span>
          <span>RIYA <b>RIDER</b></span>
        </div>

        <div className="side-label">WORKSPACE</div>

        <button className="side-link active">
          <Package size={18} /> My Deliveries
        </button>

        <div className="sidebar-bottom">
          <div className="profile-mini">
            <div className="avatar"><UserRound /></div>
            <div>
              <strong>{profile?.name || profile?.full_name || "Rider"}</strong>
              <small>Delivery partner</small>
            </div>
          </div>

          <button className="side-link logout" onClick={logout}>
            <LogOut size={18} /> Sign out
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button
            className="icon-button mobile-toggle"
            onClick={() => setMobileMenu(!mobileMenu)}
          >
            <Menu />
          </button>

          <div>
            <span className="top-kicker">RIYA SOLAR / RIDER PORTAL</span>
            <h2>{selected ? `Order #${orderId(selected)}` : "My Deliveries"}</h2>
          </div>

          <div className="top-actions">
            <span
              className="online-dot"
              style={{
                color: isOnline ? "#16a34a" : "#64748b",
                background: isOnline ? "#dcfce7" : "#e2e8f0",
                padding: "7px 11px",
                borderRadius: 20
              }}
            >
              {isOnline ? "Online" : "Offline"}
            </span>

            <button
              className="icon-button"
              title="Refresh orders"
              onClick={loadOrders}
            >
              <RefreshCw size={18} />
            </button>

            <button
              className="icon-button signout-top"
              onClick={logout}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {error && (
          <div className="alert error global-alert">
            <AlertCircle size={17} />
            {error}
            <button onClick={() => setError("")}><X size={16} /></button>
          </div>
        )}

        {notice && (
          <div className="alert success global-alert">
            <CheckCircle2 size={17} />
            {notice}
            <button onClick={() => setNotice("")}><X size={16} /></button>
          </div>
        )}

        {/* RIDER AVAILABILITY AND GPS PANEL */}
        <section
          className="section-card"
          style={{ margin: "20px 24px 0", padding: 20 }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16
            }}
          >
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  display: "grid",
                  placeItems: "center",
                  background: isOnline ? "#dcfce7" : "#f1f5f9",
                  color: isOnline ? "#15803d" : "#64748b"
                }}
              >
                {isOnline
                  ? <RadioTower size={24} />
                  : <Radio size={24} />}
              </div>

              <div>
                <strong style={{ fontSize: 16 }}>
                  Rider availability
                </strong>
                <p className="muted" style={{ margin: "4px 0 0" }}>
                  {isOnline
                    ? "You are available for deliveries."
                    : "You are currently offline."}
                </p>
              </div>
            </div>

            <button
              className="primary"
              onClick={toggleAvailability}
              disabled={gpsBusy}
              style={{
                background: isOnline ? "#dc2626" : "#15803d",
                minWidth: 150
              }}
            >
              {gpsBusy
                ? <LoaderCircle className="spin" />
                : isOnline
                  ? <WifiOff size={18} />
                  : <Wifi size={18} />}
              {gpsBusy
                ? "Please wait..."
                : isOnline
                  ? "Go Offline"
                  : "Go Online"}
            </button>
          </div>

          <div
            style={{
              marginTop: 18,
              paddingTop: 15,
              borderTop: "1px solid #e2e8f0"
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontWeight: 600,
                fontSize: 14
              }}
            >
              <LocateFixed size={18} />
              GPS tracking status
            </div>

            <p className="muted" style={{ margin: "8px 0" }}>
              {gpsMessage}
            </p>

            {gpsError && (
              <div className="alert error" style={{ marginTop: 10 }}>
                <AlertCircle size={16} />
                {gpsError}
              </div>
            )}

            {isOnline && !hasActiveDelivery && (
              <div className="info-note" style={{ marginTop: 10 }}>
                <Clock3 size={17} />
                You are online. GPS sharing will start when an active
                Out for Delivery order is assigned.
              </div>
            )}

            {gpsLocation && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
                  gap: 12,
                  marginTop: 14
                }}
              >
                <div>
                  <small className="muted">Latitude</small>
                  <strong style={{ display: "block" }}>
                    {gpsLocation.latitude.toFixed(6)}
                  </strong>
                </div>

                <div>
                  <small className="muted">Longitude</small>
                  <strong style={{ display: "block" }}>
                    {gpsLocation.longitude.toFixed(6)}
                  </strong>
                </div>

                <div>
                  <small className="muted">GPS accuracy</small>
                  <strong style={{ display: "block" }}>
                    {gpsLocation.accuracy != null
                      ? `${Math.round(gpsLocation.accuracy)} metres`
                      : "Unavailable"}
                  </strong>
                </div>

                <div>
                  <small className="muted">Last device reading</small>
                  <strong style={{ display: "block" }}>
                    {gpsLocation.recorded_at
                      ? new Date(gpsLocation.recorded_at).toLocaleTimeString()
                      : "Just now"}
                  </strong>
                </div>
              </div>
            )}

            {gpsLocation && (
              <a
                className="secondary"
                style={{
                  display: "inline-flex",
                  marginTop: 14,
                  textDecoration: "none"
                }}
                target="_blank"
                rel="noreferrer"
                href={`https://www.google.com/maps?q=${gpsLocation.latitude},${gpsLocation.longitude}`}
              >
                <MapPin size={16} />
                View my current location
              </a>
            )}
          </div>
        </section>

        {selected ? (
          <section className="content">
            <button
              className="back-link"
              onClick={() => {
                setSelected(null);
                setDetail(null);
              }}
            >
              ← Back to deliveries
            </button>

            {!detail && (
              <div className="loading-line">
                <LoaderCircle className="spin" />
                Loading order details…
              </div>
            )}

            <div className="detail-grid">
              <div className="detail-main">
                <div className="section-card order-heading">
                  <div>
                    <span className="eyebrow">DELIVERY DETAILS</span>
                    <h1>Order #{orderId(current)}</h1>
                    <p className="muted">
                      Review the information before completing delivery.
                    </p>
                  </div>

                  <span className={`status ${statusOf(current).toLowerCase().replaceAll(" ", "-")}`}>
                    {statusOf(current)}
                  </span>
                </div>

                <div className="section-card">
                  <h3><UserRound /> Customer information</h3>
                  <div className="customer-row">
                    <div>
                      <strong>{customerName(current)}</strong>
                      <p className="muted">
                        {phone || "Phone number unavailable"}
                      </p>
                    </div>

                    {phone && (
                      <a className="round-action" href={`tel:${phone}`}>
                        <Phone size={18} /> Call
                      </a>
                    )}
                  </div>
                </div>

                <div className="section-card">
                  <h3><MapPin /> Delivery address</h3>
                  <p className="address-text">
                    {address || "Address not available in API response."}
                  </p>

                  {address && (
                    <a
                      className="primary map-button"
                      target="_blank"
                      rel="noreferrer"
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                    >
                      <Navigation size={17} />
                      Navigate with Google Maps
                    </a>
                  )}
                </div>

                <div className="section-card">
                  <h3><Package /> Order items</h3>

                  {items.length ? items.map((item, index) => (
                    <div className="item-row" key={item.id || index}>
                      <div>
                        <strong>
                          {item.product_name || item.name || item.title || "Product"}
                        </strong>
                        <small>Qty: {item.quantity ?? item.qty ?? 1}</small>
                      </div>
                      <strong>
                        {money(item.total_price ?? item.subtotal ?? item.price)}
                      </strong>
                    </div>
                  )) : (
                    <p className="muted">Item details are not available.</p>
                  )}
                </div>
              </div>

              <div className="detail-side">
                <div className="section-card amount-card">
                  <span className="eyebrow">ORDER AMOUNT</span>
                  <h1>{money(amountOf(current))}</h1>
                  <div className="payment-line">
                    <IndianRupee size={16} />
                    {current?.payment_method ||
                      current?.payment_type ||
                      "Payment method not provided"}
                  </div>
                  <p className="muted">{current?.payment_status || ""}</p>
                </div>

                <div className="section-card">
                  <h3><Clock3 /> Delivery action</h3>
                  <p className="muted">
                    Confirm delivery only after handing over the order
                    to the customer.
                  </p>

                  {statusOf(current) === "Out for Delivery" ? (
                    <button
                      className="primary delivered-button"
                      onClick={markDelivered}
                      disabled={delivering}
                    >
                      {delivering
                        ? <LoaderCircle className="spin" />
                        : <CheckCircle2 />}
                      Mark as Delivered
                    </button>
                  ) : (
                    <div className="info-note">
                      <AlertCircle size={17} />
                      This order cannot be marked delivered from its current status.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="content">
            <div className="welcome-row">
              <div>
                <span className="eyebrow">YOUR DELIVERY WORKSPACE</span>
                <h1>
                  Hello, {profile?.name?.split(" ")[0] || "Rider"} 👋
                </h1>
                <p className="muted">
                  Here is your delivery activity and assigned orders.
                </p>
              </div>

              <button
                className="primary refresh-button"
                onClick={loadOrders}
                disabled={loading}
              >
                {loading
                  ? <LoaderCircle className="spin" />
                  : <RefreshCw size={17} />}
                Refresh
              </button>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon navy"><Package /></div>
                <div><span>Total assigned</span><strong>{stats.total}</strong></div>
              </div>

              <div className="stat-card">
                <div className="stat-icon orange"><Truck /></div>
                <div><span>Active deliveries</span><strong>{stats.active}</strong></div>
              </div>

              <div className="stat-card">
                <div className="stat-icon green"><CheckCircle2 /></div>
                <div><span>Delivered</span><strong>{stats.delivered}</strong></div>
              </div>

              <div className="stat-card">
                <div className="stat-icon blue"><Clock3 /></div>
                <div><span>Other orders</span><strong>{stats.ready}</strong></div>
              </div>
            </div>

            <div className="orders-toolbar">
              <div>
                <h2>Assigned orders</h2>
                <p className="muted">
                  Orders assigned to your rider account.
                </p>
              </div>

              <div className="search-box">
                <Search size={17} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search order or customer"
                />
              </div>
            </div>

            <div className="filter-row">
              {["All", "Active", "Delivered", "Other"].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`filter-chip ${filter === f ? "selected" : ""}`}
                >
                  {f}
                </button>
              ))}
            </div>

            {loading && !orders.length ? (
              <div className="empty-state">
                <LoaderCircle className="spin" />
                <p>Loading your assigned orders…</p>
              </div>
            ) : visibleOrders.length ? (
              <div className="orders-grid">
                {visibleOrders.map(order => (
                  <button
                    className="order-card"
                    key={orderId(order)}
                    onClick={() => openOrder(order)}
                  >
                    <div className="order-card-top">
                      <span className="order-number">
                        ORDER #{orderId(order)}
                      </span>
                      <span className={`status ${statusOf(order).toLowerCase().replaceAll(" ", "-")}`}>
                        {statusOf(order)}
                      </span>
                    </div>

                    <div className="order-customer">
                      <div className="customer-avatar"><UserRound /></div>
                      <div>
                        <strong>{customerName(order)}</strong>
                        <small>
                          {customerPhone(order) || "No phone provided"}
                        </small>
                      </div>
                    </div>

                    <div className="order-address">
                      <MapPin size={16} />
                      <span>
                        {addressOf(order) || "Delivery address unavailable"}
                      </span>
                    </div>

                    <div className="order-card-bottom">
                      <strong>{money(amountOf(order))}</strong>
                      <span>
                        View details <ChevronRight size={16} />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <Package size={34} />
                <h3>No orders found</h3>
                <p>
                  Assigned orders will appear here when your administrator
                  dispatches them.
                </p>
                <button className="secondary" onClick={loadOrders}>
                  <RefreshCw size={16} /> Refresh orders
                </button>
              </div>
            )}
          </section>
        )}

        <footer className="footer">
          RIYA SOLAR · RIDER PORTAL
          <span>Deliver with care.</span>
        </footer>
      </main>
    </div>
  );
}
