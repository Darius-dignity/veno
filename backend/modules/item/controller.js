import ItemDTO from "./dto.js"

class ItemController {
  constructor({ itemService }) {
    this.itemService = itemService
  }

  // Public: GET /items/menu/:categoryId
  getMenu = async (req, res) => {
    const items = await this.itemService.getMenuItems(req.params.categoryId)

    res.status(200).json(ItemDTO.toMenuItemListDTO(items))
  }

  // Admin: GET /items?category=<id>&isAvailable=true
  getAll = async (req, res) => {
    const items = await this.itemService.getAllItems(req.query)

    res.status(200).json(ItemDTO.toItemListDTO(items))
  }

  // Admin: GET /items/:id
  getById = async (req, res) => {
    const item = await this.itemService.getItemById(req.params.id)

    res.status(200).json(ItemDTO.toItemDTO(item))
  }

  // Admin: POST /items
  create = async (req, res) => {
    // req.file exists only when an image was uploaded
    const data = req.file ? { ...req.body, image: req.file.filename } : req.body

    const item = await this.itemService.createItem(data)

    res.status(201).json(ItemDTO.toItemDTO(item))
  }

  // Admin: PATCH /items/:id
  update = async (req, res) => {
    const data = req.file ? { ...req.body, image: req.file.filename } : req.body

    const item = await this.itemService.updateItem(req.params.id, data)

    res.status(200).json(ItemDTO.toItemDTO(item))
  }

  // Admin: DELETE /items/:id
  delete = async (req, res) => {
    await this.itemService.deleteItem(req.params.id)

    res.status(204).send()
  }
}

export default ItemController
