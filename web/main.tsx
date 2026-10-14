import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { Calendar, CalendarDay, Today } from './admin/day.tsx'
import { AdminLayout, Login } from './admin/layout.tsx'
import { Blackouts, Templates } from './admin/rules.tsx'
import { Devices, Logs, Otp, Settings } from './admin/system.tsx'
import { KioskDates, KioskDone, KioskLayout, KioskPeople, KioskSlots } from './kiosk.tsx'
import { Availability, Guide, News, PublicLayout } from './public.tsx'
import './style.css'

// URLs follow the spec §8 screen list.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Availability />} />
          <Route path="day/:date" element={<Availability />} />
          <Route path="guide" element={<Guide />} />
          <Route path="news" element={<News />} />
        </Route>
        <Route path="kiosk" element={<KioskLayout />}>
          <Route index element={<KioskDates />} />
          <Route path="done" element={<KioskDone />} />
          <Route path=":date" element={<KioskSlots />} />
          <Route path=":date/:slot" element={<KioskPeople />} />
        </Route>
        <Route path="admin/login" element={<Login />} />
        <Route path="admin" element={<AdminLayout />}>
          <Route index element={<Today />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="calendar/:date" element={<CalendarDay />} />
          <Route path="templates" element={<Templates />} />
          <Route path="blackouts" element={<Blackouts />} />
          <Route path="settings" element={<Settings />} />
          <Route path="otp" element={<Otp />} />
          <Route path="devices" element={<Devices />} />
          <Route path="logs" element={<Logs />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
