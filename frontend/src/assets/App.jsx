import { BrowserRouter ,Routes, Route } from "react-router-dom"
import { SWRConfig } from "swr"
import fetcher from "./utils/fetcher.js"

import Header from "./layouts/header.jsx"
import Dashboard from "./pages/dashboard/wrapper.jsx"

const App = () => {
  return (
    <SWRConfig value={{ fetcher, suspense: true, revalidateOnFocus: false }}>
      <BrowserRouter>
        <Header />
        <main className="mt-14">
          <Routes>
            <Route path="/" element={<Dashboard />} />
          </Routes>
        </main>
      </BrowserRouter>
    </SWRConfig>
  )
}

export default App