import { Routes, Route } from "react-router-dom"

const App = () => {
  return (
    <>
      <Routes>
        <Route path="/route" element={<h1>Hello Router</h1>} />
      </Routes>
    </>
  )
}

export default App