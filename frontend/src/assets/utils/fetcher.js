import axios from "axios"

async function fetcher(url) {
    const response = await axios.get(url)
    return response.data
}

export default fetcher