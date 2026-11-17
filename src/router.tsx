import { createBrowserRouter, Navigate } from 'react-router'
import { PublicOnly, RequireAuth } from './auth/guards'
import { AppShell } from './components/AppShell'
import { Catalog } from './pages/catalog/Catalog'
import { Dashboard } from './pages/Dashboard'
import { DeliveriesList } from './pages/godown/DeliveriesList'
import { ReceiveDelivery } from './pages/godown/ReceiveDelivery'
import { Locations } from './pages/locations/Locations'
import { Login } from './pages/Login'
import { OrderDetailPage } from './pages/orders/OrderDetail'
import { OrderNew } from './pages/orders/OrderNew'
import { OrdersList } from './pages/orders/OrdersList'
import { Setup } from './pages/Setup'
import { DailyReport } from './pages/stock/DailyReport'
import { Movements } from './pages/stock/Movements'
import { StockAdjust } from './pages/stock/StockAdjust'
import { StockDashboard } from './pages/stock/StockDashboard'
import { StockTransfer } from './pages/stock/StockTransfer'
import { Vendors } from './pages/vendors/Vendors'

export const router = createBrowserRouter([
  {
    element: <PublicOnly />,
    children: [
      { path: '/login', element: <Login /> },
      { path: '/setup', element: <Setup /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/', element: <Dashboard /> },
          { path: '/catalog', element: <Catalog /> },
          { path: '/vendors', element: <Vendors /> },
          { path: '/locations', element: <Locations /> },
          { path: '/orders', element: <OrdersList /> },
          { path: '/orders/new', element: <OrderNew /> },
          { path: '/orders/:id', element: <OrderDetailPage /> },
          { path: '/godown', element: <DeliveriesList /> },
          { path: '/godown/receive', element: <ReceiveDelivery /> },
          { path: '/stock', element: <StockDashboard /> },
          { path: '/stock/adjust', element: <StockAdjust /> },
          { path: '/stock/transfer', element: <StockTransfer /> },
          { path: '/stock/movements', element: <Movements /> },
          { path: '/stock/report', element: <DailyReport /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
