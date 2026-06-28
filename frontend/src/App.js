import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "./context/AuthContext";
import { I18nProvider } from "./i18n";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ClientDashboard from "./pages/ClientDashboard";
import NewShipment from "./pages/NewShipment";
import Estimate from "./pages/Estimate";
import TrackShipment from "./pages/TrackShipment";
import ShipmentDetail from "./pages/ShipmentDetail";
import BackofficeDashboard from "./pages/BackofficeDashboard";
import ShipmentsList from "./pages/ShipmentsList";
import ClientsList from "./pages/ClientsList";
import ClientDetailPage from "./pages/ClientDetailPage";
import Agencies from "./pages/Agencies";
import AgencyDetailPage from "./pages/AgencyDetailPage";
import EditShipment from "./pages/EditShipment";
import Scanner from "./pages/Scanner";
import Profile from "./pages/Profile";

function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-center" richColors />
          <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/track" element={<TrackShipment />} />
                <Route path="/estimate" element={<Estimate />} />
                <Route path="/app" element={<ProtectedRoute><ClientDashboard /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/app/new" element={<ProtectedRoute><NewShipment /></ProtectedRoute>} />
                <Route path="/shipment/:id" element={<ProtectedRoute><ShipmentDetail /></ProtectedRoute>} />
                <Route path="/shipment/:id/edit" element={<ProtectedRoute><EditShipment /></ProtectedRoute>} />
                <Route path="/back-office" element={<ProtectedRoute staffOnly><BackofficeDashboard /></ProtectedRoute>} />
                <Route path="/back-office/new-shipment" element={<ProtectedRoute staffOnly><NewShipment /></ProtectedRoute>} />
                <Route path="/back-office/shipments" element={<ProtectedRoute staffOnly><ShipmentsList /></ProtectedRoute>} />
                <Route path="/back-office/clients" element={<ProtectedRoute staffOnly><ClientsList /></ProtectedRoute>} />
                <Route path="/back-office/clients/:id" element={<ProtectedRoute staffOnly><ClientDetailPage /></ProtectedRoute>} />
                <Route path="/back-office/agencies" element={<ProtectedRoute staffOnly><Agencies /></ProtectedRoute>} />
                <Route path="/back-office/agencies/:id" element={<ProtectedRoute staffOnly><AgencyDetailPage /></ProtectedRoute>} />
                <Route path="/scanner" element={<ProtectedRoute staffOnly><Scanner /></ProtectedRoute>} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </I18nProvider>
  );
}

export default App;
