import CategoryDTO from "./dto.js"

class CategoryController {
  constructor({ categoryService }) {
    this.categoryService = categoryService
  }

  // Public: GET /categories/menu
  getMenu = async (req, res) => {
    const categories = await this.categoryService.getMenuCategories()

    res.status(200).json(CategoryDTO.toMenuCategoryListDTO(categories))
  }

  // Admin: GET /categories?isActive=true
  getAll = async (req, res) => {
    const categories = await this.categoryService.getAllCategories(req.query)

    res.status(200).json(CategoryDTO.toCategoryListDTO(categories))
  }

  // Admin: GET /categories/:id
  getById = async (req, res) => {
    const category = await this.categoryService.getCategoryById(req.params.id)

    res.status(200).json(CategoryDTO.toCategoryDTO(category))
  }

  // Admin: POST /categories
  create = async (req, res) => {
    // req.file exists only when an icon was uploaded
    const data = req.file ? { ...req.body, icon: req.file.filename } : req.body

    const category = await this.categoryService.createCategory(data)

    res.status(201).json(CategoryDTO.toCategoryDTO(category))
  }

  // Admin: PATCH /categories/:id
  update = async (req, res) => {
    const data = req.file ? { ...req.body, icon: req.file.filename } : req.body

    const category = await this.categoryService.updateCategory(
      req.params.id,
      data
    )

    res.status(200).json(CategoryDTO.toCategoryDTO(category))
  }

  // Admin: DELETE /categories/:id
  delete = async (req, res) => {
    await this.categoryService.deleteCategory(req.params.id)

    res.status(204).send()
  }
}

export default CategoryController