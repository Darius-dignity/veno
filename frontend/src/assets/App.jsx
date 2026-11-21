import { BrowserRouter ,Routes, Route } from "react-router-dom"
import { SWRConfig } from "swr"
import fetcher from "./utils/fetcher.js"

import Dashboard from "./pages/dashboard/wrapper.jsx"

const App = () => {
  return (
    <SWRConfig value={{ fetcher, suspense: true, revalidateOnFocus: false }}>
      <BrowserRouter>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </BrowserRouter>
    </SWRConfig>
  )
}

export default App