import { useState } from "react"
import { IconSun, IconMoon } from "@tabler/icons-react"

const Header = () => {

    const [isDark, setIsDark] = useState(true)

    function handleToggleTheme() {
        setIsDark(prev => !prev)
        const theme = document.documentElement.getAttribute("data-theme")
        document.documentElement.setAttribute("data-theme", theme === "light" ? "dark" : "light")
    }

    return (
        <header className="w-full h-14 flex fixed top-0 flex-row bg-bgc shadow-sc">
            <div className="h-full w-3/12 flex items-center justify-center">
                <img src="/public/images/statics/logo.jpg" alt="logo" className="h-full aspect-square" />
            </div>
            <div className="h-full w-5/12 flex justify-center items-center text-2xl text-pr font-semibold">
                <h1 className="">کافه ونو</h1>
            </div>
            <div className="h-full w-2/12 flex justify-center items-center">

            </div>
            <div className="h-full w-2/12 flex items-center justify-center">
                <button onClick={handleToggleTheme} className="relative flex h-9 w-17 items-center rounded-full p-1 transition-colors duration-300 bg-frc">
                    <IconMoon size={18} className="absolute left-2 text-sech" />
                    <IconSun size={18} className="absolute right-2 text-pr" />
                    <span className={`z-10 flex h-7 w-7 items-center  justify-center rounded-full bg-white shadow-md transition-transform duration-300 ${isDark ?  "-translate-x-8" : "translate-x-0"}`}>
                        {
                            isDark ? (
                                <IconMoon size={16} className="text-sech" />
                            ) : (
                                <IconSun size={16} className="text-pr" />
                            )
                        }
                    </span>
                </button>
            </div>
        </header>
    )
}

export default Header