/** @odoo-module **/

import {X2ManyField, x2ManyField} from "@web/views/fields/x2many/x2many_field";
import {onWillRender, useRef, useState} from "@odoo/owl";
import {registry} from "@web/core/registry";

export class FsImageRelationDndUploadField extends X2ManyField {
    setup() {
        super.setup();
        this.relationField = this.field.relation_field;
        this.defaultTarget = this.props.crudOptions.target || "specific";
        this.state = useState({
            dragging: false,
            target: this.defaultTarget,
        });
        this.fileInput = useRef("fileInput");
        this.defaultSequence = 0;

        onWillRender(() => {
            this.initDefaultSequence();
        });
    }

    get targetImage() {
        return this.state.target;
    }

    get displayDndZone() {
        const activeActions = this.activeActions;
        return (
            ("link" in activeActions ? activeActions.link : activeActions.create) &&
            !this.props.readonly
        );
    }

    initDefaultSequence() {
        let sequence = 0;
        $.each(this.props.record.data[this.props.name].records, (i, record) => {
            sequence = record.data.sequence;
            if (sequence >= this.defaultSequence) {
                this.defaultSequence = sequence + 1;
            }
        });
    }

    getNewSequence() {
        const sequence = this.defaultSequence;
        this.defaultSequence += 1;
        return sequence;
    }

    setDragging() {
        this.state.dragging = true;
    }

    setNotDragging() {
        this.state.dragging = false;
    }

    onDragEnter(ev) {
        ev.preventDefault();
        this.setDragging();
    }

    onDragLeave(ev) {
        ev.preventDefault();
        this.setNotDragging();
    }

    onClickSelectDocuments(ev) {
        ev.preventDefault();
        this.fileInput.el.click();
    }

    onDrop(ev) {
        ev.preventDefault();
        this.setNotDragging();
        this.uploadImages(ev.dataTransfer.files);
    }

    onFilesSelected(ev) {
        ev.preventDefault();
        this.uploadImages(ev.target.files);
    }

    onChangeImageTarget(ev) {
        this.state.target = ev.target.value;
    }

    async uploadFsImage(imagesDesc) {
        const self = this;
        const createValues = [];
        self.env.model.orm
            .call("fs.image", "create", [imagesDesc])
            .then((fsImageIds) => {
                let values = {};
                $.each(fsImageIds, (i, fsImageId) => {
                    values = self.getFsImageRelationValues(fsImageId);
                    createValues.push(values);
                });
            })
            .then(() => {
                self.createFieldRelationRecords(createValues);
            })
            .catch(() => {
                self.displayUploadError();
            });
    }

    displayUploadError() {
        this.env.services.ui.unblock();
        this.env.services.notification.add(
            this.env._t("An error occurred during the images upload."),
            {
                type: "danger",
                sticky: true,
            }
        );
    }

    getFsImageRelationValues(fsImageId) {
        let values = {
            image_id: fsImageId,
            link_existing: true,
        };
        values = {...values, ...this.getRelationCommonValues()};
        return values;
    }

    async uploadSpecificImage(imagesDesc) {
        const self = this;
        const createValues = [];
        $.each(imagesDesc, (i, imageDesc) => {
            createValues.push(self.getSpecificImageRelationValues(imageDesc));
        });
        self.createFieldRelationRecords(createValues);
    }

    getSpecificImageRelationValues(imageDesc) {
        return {...imageDesc, ...this.getRelationCommonValues()};
    }

    getRelationCommonValues() {
        const values = {
            sequence: this.getNewSequence(),
        };
        values[this.relationField] = this.props.record.data.id;
        return values;
    }

    async createFieldRelationRecords(createValues) {
        const self = this;
        const model = self.env.model;
        model.orm
            .call(self.field.relation, "create", [createValues])
            .then(() => {
                model.root.load();
                model.root.save();
            })
            .then(() => {
                self.env.services.ui.unblock();
            })
            .catch(() => {
                self.displayUploadError();
            });
    }

    async uploadImages(files) {
        const self = this;
        const promises = [];
        this.env.services.ui.block();
        $.each(files, function (i, file) {
            if (!file.type.includes("image")) {
                return;
            }
            const filePromise = new Promise(function (resolve) {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = function (upload) {
                    let data = upload.target.result;
                    data = data.split(",")[1];
                    resolve([file.name, data]);
                };
            });
            promises.push(filePromise);
        });
        return Promise.all(promises).then(function (fileContents) {
            const imagesDesc = [];
            $.each(fileContents, function (i, fileContent) {
                imagesDesc.push(self.getFileImageDesc(fileContent));
            });
            if (imagesDesc.length > 0) {
                switch (self.targetImage) {
                    case "fs_image":
                        self.uploadFsImage(imagesDesc);
                        break;
                    case "specific":
                        self.uploadSpecificImage(imagesDesc);
                        break;
                    default:
                        self.env.services.ui.unblock();
                }
            } else {
                self.env.services.ui.unblock();
            }
        });
    }

    getFileImageDesc(fileContent) {
        return {
            image: {
                filename: fileContent[0],
                content: fileContent[1],
            },
        };
    }
}

FsImageRelationDndUploadField.template = "web.FsImageRelationDndUploadField";

export const fsImageRelationDndUploadField = {
    ...x2ManyField,
    component: FsImageRelationDndUploadField,
};

registry
    .category("fields")
    .add("fs_image_relation_dnd_upload", fsImageRelationDndUploadField);
