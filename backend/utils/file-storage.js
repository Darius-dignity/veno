import fs from "node:fs/promises"
import path from "node:path"

class FileStorage {
  constructor({ directory }) {
    this.directory = directory
  }

  // Never throws: a leftover file must not turn a successful request into an error
  async remove(filename) {
    if (!filename) return

    // basename blocks path traversal such as "../../something"
    const target = path.join(this.directory, path.basename(filename))

    try {
      await fs.unlink(target)
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.error(`Could not remove file ${target}:`, error.message)
      }
    }
  }
}

export default FileStorage
