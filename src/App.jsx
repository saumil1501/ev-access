import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import {
  Activity, ArrowDownRight, ArrowUpRight, BatteryCharging, CarFront, Check,
  ChevronDown, CircleHelp, Clock3, Compass, Filter, Gauge, LocateFixed,
  MapPin, Navigation, PlugZap, Search, ShieldCheck, SlidersHorizontal,
  TrendingUp, Zap
} from "lucide-react";

const BENGALURU = [12.9716, 77.5946];

const SAMPLE_STATIONS = [
  { id:"s1", name:"Indiranagar Charge Hub", lat:12.9784, lon:77.6408, address:"100 Feet Road, Indiranagar", connector:"CCS2", power:60, status:"Available", price:18, network:"EV Access Demo", simulated:true },
  { id:"s2", name:"MG Road Fast Charge", lat:12.9758, lon:77.6063, address:"Mahatma Gandhi Road", connector:"CCS2", power:120, status:"Busy", price:22, network:"EV Access Demo", simulated:true },
  { id:"s3", name:"Koramangala Green Point", lat:12.9352, lon:77.6245, address:"5th Block, Koramangala", connector:"Type 2", power:22, status:"Available", price:14, network:"EV Access Demo", simulated:true },
  { id:"s4", name:"Jayanagar Community Charger", lat:12.9250, lon:77.5838, address:"4th Block, Jayanagar", connector:"Type 2", power:7, status:"Available", price:12, network:"EV Access Demo", simulated:true },
  { id:"s5", name:"Hebbal Express Charge", lat:13.0358, lon:77.5970, address:"Outer Ring Road, Hebbal", connector:"CCS2", power:150, status:"Available", price:24, network:"EV Access Demo", simulated:true },
  { id:"s6", name:"Whitefield EV Stop", lat:12.9698, lon:77.7500, address:"ITPL Main Road, Whitefield", connector:"CCS2", power:60, status:"Busy", price:20, network:"EV Access Demo", simulated:true },
  { id:"s7", name:"Malleshwaram City Charge", lat:13.0031, lon:77.5700, address:"Sampige Road, Malleshwaram", connector:"Type 2", power:22, status:"Available", price:15, network:"EV Access Demo", simulated:true },
  { id:"s8", name:"Electronic City Power Point", lat:12.8452, lon:77.6602, address:"Phase 1, Electronic City", connector:"CCS2", power:90, status:"Available", price:21, network:"EV Access Demo", simulated:true },
  { id:"s9", name:"Yelahanka Charge Corner", lat:13.1007, lon:77.5963, address:"Yelahanka New Town", connector:"CCS2", power:60, status:"Unknown", price:19, network:"EV Access Demo", simulated:true },
  { id:"s10", name:"Banashankari EV Point", lat:12.9255, lon:77.5468, address:"Banashankari 2nd Stage", connector:"Type 2", power:11, status:"Available", price:13, network:"EV Access Demo", simulated:true }
];

function distanceKm(a, b) {
  const rad = n => n * Math.PI / 180;
  const dLat = rad(b[0] - a[0]), dLon = rad(b[1] - a[1]);
  const x = Math.sin(dLat/2)**2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon/2)**2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
}
function MapRecenter({ center }) {
  const map = useMap();
  useEffect(() => { map.flyTo(center, 12, { duration: 0.8 }); }, [center, map]);
  return null;
}
function formatDistance(km) {
  return km < 1 ? `${Math.round(km*1000)} m` : `${km.toFixed(1)} km`;
}

export default function App() {
  const [stations, setStations] = useState(SAMPLE_STATIONS);
  const [dataMode, setDataMode] = useState("demo");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("Demo data shown · station availability and prices are illustrative");
  const [center, setCenter] = useState(BENGALURU);
  const [userLocation, setUserLocation] = useState(null);
  const [search, setSearch] = useState("");
  const [connector, setConnector] = useState("All connectors");
  const [speed, setSpeed] = useState("Any speed");
  const [availability, setAvailability] = useState("Any status");
  const [radius, setRadius] = useState(25);
  const [selectedId, setSelectedId] = useState("s1");
  const [activeTab, setActiveTab] = useState("explore");
  const [showFilters, setShowFilters] = useState(true);

  async function loadLiveStations() {
    setLoading(true);
    setNotice("Connecting to OpenStreetMap charging-station data…");
    // Public Overpass endpoint. It may rate-limit requests; demo data remains available as a fallback.
    const [lat, lon] = center;
    const query = `[out:json][timeout:18];(node["amenity"="charging_station"](around:25000,${lat},${lon});way["amenity"="charging_station"](around:25000,${lat},${lon}););out center tags;`;
    try {
      const response = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: "data=" + encodeURIComponent(query),
        signal: AbortSignal.timeout(22000)
      });
      if (!response.ok) throw new Error("The public map data service is temporarily unavailable.");
      const json = await response.json();
      const parsed = (json.elements || []).map((el, i) => {
        const tags = el.tags || {};
        const latVal = el.lat ?? el.center?.lat;
        const lonVal = el.lon ?? el.center?.lon;
        if (typeof latVal !== "number" || typeof lonVal !== "number") return null;
        const rawPower = Number(String(tags["socket:output"] || tags.output || "").match(/[0-9]+/)?.[0]);
        const connector = tags["socket:type2"] === "yes" ? "Type 2" :
          (tags["socket:ccs"] === "yes" || tags["socket:ccs2"] === "yes") ? "CCS2" :
          tags["socket:chademo"] === "yes" ? "CHAdeMO" : "Unknown";
        return {
          id: `osm-${el.type}-${el.id || i}`,
          name: tags.name || tags.operator || "EV charging station",
          lat: latVal, lon: lonVal,
          address: [tags["addr:street"], tags["addr:city"]].filter(Boolean).join(", ") || "Address not listed in OpenStreetMap",
          connector, power: Number.isFinite(rawPower) && rawPower > 0 ? rawPower : null,
          status: "Unknown", price: null, network: tags.operator || "OpenStreetMap",
          simulated: false
        };
      }).filter(Boolean);
      if (!parsed.length) throw new Error("No mapped charging stations were returned for this area.");
      setStations(parsed);
      setDataMode("live");
      setSelectedId(parsed[0].id);
      setNotice(`Live OpenStreetMap data · ${parsed.length} mapped station${parsed.length === 1 ? "" : "s"} · availability and prices may not be published`);
    } catch (error) {
      setStations(SAMPLE_STATIONS);
      setDataMode("demo");
      setNotice(`${error.message || "Could not load live data."} Showing clearly labelled demo stations instead.`);
    } finally {
      setLoading(false);
    }
  }

  function locateMe() {
    if (!navigator.geolocation) {
      setNotice("Geolocation is not supported by this browser. Showing Bengaluru demo area.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const next = [pos.coords.latitude, pos.coords.longitude];
        setCenter(next);
        setUserLocation(next);
        setNotice("Your location is being used for distance estimates on this device.");
      },
      () => setNotice("Location permission was not granted. You can still explore the map manually."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  const stationsWithDistance = useMemo(() => stations.map(s => ({
    ...s, distance: distanceKm(userLocation || center, [s.lat, s.lon])
  })), [stations, center, userLocation]);

  const filtered = useMemo(() => stationsWithDistance.filter(s => {
    const text = `${s.name} ${s.address} ${s.connector} ${s.network}`.toLowerCase();
    const matchesSearch = text.includes(search.toLowerCase());
    const matchesConnector = connector === "All connectors" || s.connector === connector || (connector === "Other / unknown" && s.connector === "Unknown");
    const matchesSpeed = speed === "Any speed" || (speed === "Fast (50 kW+)" && s.power >= 50) || (speed === "Standard (under 50 kW)" && s.power !== null && s.power < 50) || (speed === "Power not listed" && !s.power);
    const matchesStatus = availability === "Any status" || s.status === availability;
    return matchesSearch && matchesConnector && matchesSpeed && matchesStatus && s.distance <= radius;
  }).sort((a,b) => a.distance-b.distance), [stationsWithDistance, search, connector, speed, availability, radius]);

  const selected = stationsWithDistance.find(s => s.id === selectedId);
  const availableCount = filtered.filter(s => s.status === "Available").length;
  const fastCount = filtered.filter(s => s.power >= 50).length;
  const coverageScore = Math.min(100, Math.round((filtered.length / Math.max(1, Math.ceil(radius/5))) * 12));
  const areas = [
    { name:"Central Bengaluru", count:stations.filter(s => distanceKm([12.9716,77.5946],[s.lat,s.lon]) < 6).length, note:"Dense urban activity" },
    { name:"East Bengaluru", count:stations.filter(s => s.lon > 77.66).length, note:"IT corridor & residential growth" },
    { name:"North Bengaluru", count:stations.filter(s => s.lat > 13.02).length, note:"Airport and highway corridor" },
    { name:"South Bengaluru", count:stations.filter(s => s.lat < 12.94).length, note:"Residential and education zones" }
  ];
  const isDemo = dataMode === "demo";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Zap size={22} fill="currentColor" /></div>
          <div><div className="brand-name">EV<span>ACCESS</span></div><div className="brand-sub">SMART CHARGING NETWORK</div></div>
        </div>
        <div className="sidebar-label">WORKSPACE</div>
        <button className={`nav-item ${activeTab === "explore" ? "active" : ""}`} onClick={() => setActiveTab("explore")}><Compass size={18}/> Explore stations <span className="nav-dot"/></button>
        <button className={`nav-item ${activeTab === "insights" ? "active" : ""}`} onClick={() => setActiveTab("insights")}><Activity size={18}/> Accessibility insights</button>
        <div className="sidebar-bottom">
          <div className="impact-card">
            <div className="impact-icon"><ShieldCheck size={19}/></div>
            <div className="impact-title">Cleaner trips start here.</div>
            <p>Making charging easier can help make electric mobility a practical choice.</p>
            <div className="impact-line"><span>PROJECT MISSION</span><span>01 / 01</span></div>
          </div>
          <div className="student-tag"><div className="student-avatar">EV</div><div><strong>BCS508 Project</strong><span>Environmental Studies</span></div><span className="online-dot"/></div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> <strong>{activeTab === "explore" ? "Charging explorer" : "Accessibility insights"}</strong></div>
          <div className="top-actions"><span className="live-indicator"><i/> {isDemo ? "DEMO MODE" : "OPEN MAP DATA"}</span><button className="icon-button" title="Find my location" onClick={locateMe}><LocateFixed size={17}/></button><div className="profile-chip"><div className="profile-avatar">EV</div><span>EV Driver</span><ChevronDown size={14}/></div></div>
        </header>

        <div className="page-content">
          <section className="page-heading">
            <div><div className="eyebrow"><span className="eyebrow-line"/> ELECTRIC MOBILITY / DISCOVER</div><h1>Find your next <span>charge.</span></h1><p className="page-subtitle">Discover charging stations around you. Compare distance, connector types and charging speeds.</p></div>
            <button className="primary-button" onClick={loadLiveStations} disabled={loading}><Activity size={16}/>{loading ? "Loading stations…" : "Load live stations"} <ArrowUpRight size={15}/></button>
          </section>

          <div className={`data-notice ${isDemo ? "demo-notice" : "live-notice"}`}><span className="notice-icon">{isDemo ? <CircleHelp size={16}/> : <Check size={16}/>}</span><span>{notice}</span><button onClick={() => setNotice(isDemo ? "Demo station locations are illustrative, and availability/prices are not real-time." : "OpenStreetMap is community-maintained. It does not guarantee live connector availability or pricing.")}>Details</button></div>

          {activeTab === "explore" ? <>
            <section className="metric-grid">
              <div className="metric-card"><div className="metric-top"><span>Stations in range</span><span className="metric-icon"><MapPin size={17}/></span></div><div className="metric-value">{filtered.length}<small> stations</small></div><div className="metric-foot"><span className="metric-neutral"><Activity size={13}/> Within {radius} km</span><span className="metric-caption">Based on current filters</span></div></div>
              <div className="metric-card"><div className="metric-top"><span>Listed as available</span><span className="metric-icon green"><BatteryCharging size={17}/></span></div><div className="metric-value">{isDemo ? availableCount : "—"}<small>{isDemo ? " stations" : " live status unavailable"}</small></div><div className="metric-foot"><span className="metric-neutral"><span className="mini-dot"/> {isDemo ? "Simulated status" : "Not provided by map data"}</span></div></div>
              <div className="metric-card"><div className="metric-top"><span>Fast chargers</span><span className="metric-icon purple"><Gauge size={17}/></span></div><div className="metric-value">{fastCount}<small> stations</small></div><div className="metric-foot"><span className="metric-positive"><Zap size={13}/> 50 kW or more</span><span className="metric-caption">Where power is known</span></div></div>
              <div className="metric-card"><div className="metric-top"><span>Coverage indicator</span><span className="metric-icon orange"><TrendingUp size={17}/></span></div><div className="metric-value">{coverageScore}<small>/ 100</small></div><div className="coverage-track"><span style={{width:`${coverageScore}%`}}/></div><div className="metric-foot"><span className="metric-caption">Illustrative index, not an official score</span></div></div>
            </section>

            <section className="explorer-layout">
              <div className="map-panel panel">
                <div className="panel-heading"><div><h2>Station map</h2><p>Explore chargers by location</p></div><div className="map-heading-actions"><span className="map-legend"><i className="legend-green"/> Listed available</span><button className="icon-button" onClick={() => setShowFilters(!showFilters)} title="Toggle filters"><SlidersHorizontal size={17}/></button></div></div>
                <div className="search-bar"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by station, area or connector…"/>{search && <button onClick={()=>setSearch("")}>Clear</button>}<kbd>⌕</kbd></div>
                {showFilters && <div className="filter-row">
                  <label><span>Connector</span><select value={connector} onChange={e=>setConnector(e.target.value)}><option>All connectors</option><option>CCS2</option><option>Type 2</option><option>CHAdeMO</option><option>Other / unknown</option></select></label>
                  <label><span>Charging speed</span><select value={speed} onChange={e=>setSpeed(e.target.value)}><option>Any speed</option><option>Fast (50 kW+)</option><option>Standard (under 50 kW)</option><option>Power not listed</option></select></label>
                  <label><span>Status</span><select value={availability} onChange={e=>setAvailability(e.target.value)}><option>Any status</option><option>Available</option><option>Busy</option><option>Unknown</option></select></label>
                  <label className="radius-filter"><span>Search radius <b>{radius} km</b></span><input type="range" min="5" max="50" step="5" value={radius} onChange={e=>setRadius(Number(e.target.value))}/></label>
                </div>}
                <div className="map-wrap">
                  <MapContainer center={center} zoom={12} scrollWheelZoom={true} className="leaflet-map">
                    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
                    <MapRecenter center={center}/>
                    {userLocation && <CircleMarker center={userLocation} radius={8} pathOptions={{color:"#76ff75",fillColor:"#76ff75",fillOpacity:0.9}}><Popup>Your approximate device location</Popup></CircleMarker>}
                    {filtered.map(s=><CircleMarker key={s.id} center={[s.lat,s.lon]} radius={selectedId===s.id?10:7} pathOptions={{color:selectedId===s.id?"#ffffff":s.status==="Available"?"#75f77b":"#a8b5c7",weight:selectedId===s.id?3:2,fillColor:s.status==="Available"?"#75f77b":"#5d6b80",fillOpacity:0.95}} eventHandlers={{click:()=>setSelectedId(s.id)}}><Popup><strong>{s.name}</strong><br/>{s.connector} · {s.power ? `${s.power} kW` : "Power not listed"}<br/>{s.simulated ? "Demo data" : "OpenStreetMap data"}</Popup></CircleMarker>)}
                  </MapContainer>
                  <div className="map-overlay-label"><span className="pulse-dot"/> {filtered.length} stations displayed</div>
                  <button className="map-locate" onClick={locateMe}><LocateFixed size={16}/> Locate me</button>
                  <div className="map-attribution-note">Map tiles © OpenStreetMap</div>
                </div>
                <div className="map-footer"><span><i className="legend-green"/> {isDemo ? "Demo station" : "Mapped station"}</span><span><i className="legend-muted"/> Unknown status</span><span><Navigation size={13}/> Distances are estimates</span></div>
              </div>

              <div className="stations-panel panel">
                <div className="panel-heading station-panel-heading"><div><h2>Nearby stations <span className="count-pill">{filtered.length}</span></h2><p>Closest matches first</p></div><button className="text-button" onClick={()=>{setSearch("");setConnector("All connectors");setSpeed("Any speed");setAvailability("Any status");setRadius(25)}}><Filter size={14}/> Reset</button></div>
                <div className="station-list">
                  {filtered.length === 0 && <div className="empty-state"><PlugZap size={28}/><strong>No stations match</strong><p>Try a larger radius or clear one of the filters.</p><button className="secondary-button" onClick={()=>{setSearch("");setConnector("All connectors");setSpeed("Any speed");setAvailability("Any status");setRadius(50)}}>Clear filters</button></div>}
                  {filtered.map(s=><button key={s.id} className={`station-card ${selectedId===s.id?"selected":""}`} onClick={()=>setSelectedId(s.id)}>
                    <div className="station-card-top"><div className="station-symbol"><PlugZap size={19}/></div><div className="station-name-wrap"><strong>{s.name}</strong><span>{s.address}</span></div><span className={`status-dot ${s.status==="Available"?"status-available":s.status==="Busy"?"status-busy":"status-unknown"}`} title={s.status}/></div>
                    <div className="station-tags"><span className="tag"><PlugZap size={12}/>{s.connector}</span><span className="tag"><Zap size={12}/>{s.power ? `${s.power} kW` : "Power n/a"}</span><span className="tag distance-tag"><Navigation size={12}/>{formatDistance(s.distance)}</span></div>
                    <div className="station-card-bottom"><span className={`status-label ${s.status==="Available"?"text-green":s.status==="Busy"?"text-orange":"text-muted"}`}>{s.status === "Unknown" ? "Status unknown" : s.status}</span><span className="station-price">{s.price != null ? `₹${s.price}/kWh` : "Price unavailable"} <ArrowUpRight size={13}/></span></div>
                    {s.simulated && <div className="simulated-label">SIMULATED DETAILS</div>}
                  </button>)}
                </div>
                <div className="list-footer"><span>Showing {filtered.length} of {stations.length} loaded stations</span><span className="refresh-label"><Clock3 size={12}/> {isDemo ? "Demo dataset" : "OSM snapshot"}</span></div>
              </div>
            </section>
          </> : <section className="insights-view">
            <div className="insight-intro panel"><div className="insight-icon"><Activity size={22}/></div><div><div className="eyebrow">INFRASTRUCTURE PLANNING</div><h2>Charging accessibility insights</h2><p>Use mapped station locations to explore where charging infrastructure appears concentrated or sparse. This is a student prototype, not an official planning assessment.</p></div></div>
            <div className="metric-grid insight-metrics">
              <div className="metric-card"><div className="metric-top"><span>Stations loaded</span><span className="metric-icon"><MapPin size={17}/></span></div><div className="metric-value">{stations.length}</div><div className="metric-foot"><span className="metric-caption">{isDemo ? "Illustrative sample dataset" : "Community-mapped locations"}</span></div></div>
              <div className="metric-card"><div className="metric-top"><span>Power details known</span><span className="metric-icon green"><Gauge size={17}/></span></div><div className="metric-value">{stations.filter(s=>s.power).length}</div><div className="metric-foot"><span className="metric-caption">Stations with power values</span></div></div>
              <div className="metric-card"><div className="metric-top"><span>Connector details known</span><span className="metric-icon purple"><PlugZap size={17}/></span></div><div className="metric-value">{stations.filter(s=>s.connector!=="Unknown").length}</div><div className="metric-foot"><span className="metric-caption">Stations with a mapped connector</span></div></div>
              <div className="metric-card"><div className="metric-top"><span>Price details known</span><span className="metric-icon orange"><Activity size={17}/></span></div><div className="metric-value">{stations.filter(s=>s.price != null).length}</div><div className="metric-foot"><span className="metric-caption">Not necessarily current tariffs</span></div></div>
            </div>
            <div className="panel area-panel"><div className="panel-heading"><div><h2>Area-wise distribution</h2><p>Simple geographic grouping of currently loaded stations</p></div><span className="insight-badge">PROTOTYPE ANALYSIS</span></div>
              <div className="area-list">{areas.map((area,i)=><div className="area-row" key={area.name}><div className="area-rank">0{i+1}</div><div className="area-info"><strong>{area.name}</strong><span>{area.note}</span><div className="area-bar"><span style={{width:`${Math.max(5, area.count/Math.max(1,stations.length)*100)}%`}}/></div></div><div className="area-count"><strong>{area.count}</strong><span>stations</span></div><div className={`area-status ${area.count<=1?"low":area.count<=3?"medium":"high"}`}>{area.count<=1?"Low count":area.count<=3?"Moderate":"Higher count"}</div></div>)}</div>
              <div className="insight-disclaimer"><CircleHelp size={16}/><p>Area groupings are rough latitude/longitude rules for demonstration. A real infrastructure-gap study should use population, road networks, traffic, EV registrations, charging demand, and verified station status.</p></div>
            </div>
            <div className="panel methodology-panel"><h3>How this analysis works</h3><div className="method-grid"><div><span>01</span><strong>Input</strong><p>Station coordinates, connector types and power data from the selected dataset.</p></div><div><span>02</span><strong>Processing</strong><p>Group stations into broad geographic zones and count mapped locations.</p></div><div><span>03</span><strong>Output</strong><p>Compare counts to flag areas that may deserve a closer infrastructure review.</p></div></div></div>
          </section>}

          <footer className="footer"><div><span className="footer-brand">EV<span>ACCESS</span></span><span>Designed for more accessible electric mobility.</span></div><div><span>BCS508 · Environmental Studies & E-Waste Management</span><span className="footer-separator">•</span><span>Academic prototype</span></div></footer>
        </div>
      </main>
    </div>
  );
}