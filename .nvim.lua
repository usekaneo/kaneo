vim.api.nvim_create_autocmd("FileType", {
	pattern = "yaml",
	callback = function()
		vim.bo.shiftwidth = 2
		vim.bo.tabstop = 2
		vim.bo.softtabstop = 2
		vim.bo.expandtab = true
	end,
})

local conform = require("conform")
conform.formatters_by_ft.yaml = { "yq" }
conform.formatters.yq = {
	command = "yq",
	args = { "eval", "--prettyPrint", "--indent", "2", "." },
	stdin = true,
}
