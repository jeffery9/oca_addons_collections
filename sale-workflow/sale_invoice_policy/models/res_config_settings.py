# Copyright 2018 ACSONE SA/NV (<http://acsone.eu>)
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl.html).

from odoo import api, fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = "res.config.settings"

    sale_invoice_policy_required = fields.Boolean(
        help="This makes Invoice Policy required on Sale Orders"
    )

    @api.model
    def get_values(self):
        res = super().get_values()
        res.update(
            sale_invoice_policy_required=self.env["ir.default"]._get(
                "res.config.settings", "sale_invoice_policy_required"
            )
        )
        return res

    def set_values(self):
        super().set_values()
        ir_default_obj = self.env["ir.default"]
        if self.env["res.users"].has_group("base.group_erp_manager"):
            ir_default_obj = ir_default_obj.sudo()
            ir_default_obj.set(
                "res.config.settings",
                "sale_invoice_policy_required",
                self.sale_invoice_policy_required,
            )
        return True
