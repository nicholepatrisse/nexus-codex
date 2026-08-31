# Form fields

Use `FormField` for ordinary labeled controls. The shell owns the label, required or optional cue, spacing before the control, help text, the first server field error, and the accessible relationships between them. Pass existing `fieldErrors?.name` arrays directly.

```tsx
<FormField id="eventName" label="Event name" description="Printed on the Chronicle." errors={state.fieldErrors?.eventName}>
  {(controlProps) => <input {...controlProps} name="eventName" required className={inputClass} />}
</FormField>
```

Spread `controlProps` onto the actual interactive control. Keep validation attributes, values, event handlers, and control-specific behavior there. Use `optional` only when the control is not required. Layout classes such as `sm:col-span-2` belong on `FormField`; control appearance classes belong on the input, textarea, or selector.

Complex groups may use the same shell when its supplied ID and ARIA properties can be placed on the focusable control or group. Do not add input-type flags to `FormField`.
