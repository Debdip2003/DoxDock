import {
  PDFDocument,
  PDFTextField,
  PDFCheckBox,
  PDFDropdown,
  PDFRadioGroup,
  PDFOptionList,
} from 'pdf-lib'

/** Read the interactive form fields of a PDF into plain descriptors. */
export async function readFields(file) {
  let doc
  try {
    doc = await PDFDocument.load(await file.arrayBuffer())
  } catch {
    throw new Error('Could not read this PDF. Encrypted PDFs are not supported.')
  }
  const form = doc.getForm()
  const fields = form.getFields()
  if (!fields.length) {
    throw new Error('This PDF has no fillable form fields (AcroForm). Nothing to fill.')
  }
  return fields.map((f) => {
    const name = f.getName()
    if (f instanceof PDFTextField) return { name, type: 'text', value: f.getText() || '' }
    if (f instanceof PDFCheckBox) return { name, type: 'checkbox', value: f.isChecked() }
    if (f instanceof PDFDropdown) return { name, type: 'dropdown', value: f.getSelected()[0] || '', options: f.getOptions() }
    if (f instanceof PDFRadioGroup) return { name, type: 'radio', value: f.getSelected() || '', options: f.getOptions() }
    if (f instanceof PDFOptionList) return { name, type: 'optionlist', value: f.getSelected()[0] || '', options: f.getOptions() }
    return { name, type: 'unsupported', value: '' }
  })
}

/** Apply values to the form and optionally flatten (bake in) the results. */
export async function fillForm(file, values, flatten, onProgress) {
  onProgress?.(0.2, 'Opening PDF…')
  const doc = await PDFDocument.load(await file.arrayBuffer())
  const form = doc.getForm()
  onProgress?.(0.5, 'Filling fields…')
  for (const field of Object.values(values)) {
    const { name, type, value } = field
    try {
      if (type === 'text') form.getTextField(name).setText(value ?? '')
      else if (type === 'checkbox') value ? form.getCheckBox(name).check() : form.getCheckBox(name).uncheck()
      else if (type === 'dropdown' && value) form.getDropdown(name).select(value)
      else if (type === 'radio' && value) form.getRadioGroup(name).select(value)
      else if (type === 'optionlist' && value) form.getOptionList(name).select(value)
    } catch {
      /* skip fields that reject a value */
    }
  }
  if (flatten) {
    onProgress?.(0.8, 'Flattening…')
    form.flatten()
  }
  const bytes = await doc.save()
  onProgress?.(1, 'Done')
  return new Blob([bytes], { type: 'application/pdf' })
}
