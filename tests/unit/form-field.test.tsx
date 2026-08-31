import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FormField } from "@/app/form-field";

describe("FormField", () => {
  it("connects its label, help, and server error to the control", () => {
    const markup = renderToStaticMarkup(<FormField id="character-name" label="Character name" description="Use the name on the sheet." errors={["Enter a name."]}>{(props) => <input {...props} name="name" />}</FormField>);
    expect(markup).toContain('for="character-name"');
    expect(markup).toContain('id="character-name"');
    expect(markup).toContain('aria-describedby="character-name-description character-name-error"');
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('id="character-name-error" role="alert"');
  });

  it("renders a consistent optional cue without invalid attributes", () => {
    const markup = renderToStaticMarkup(<FormField id="notes" label="Notes" optional>{(props) => <textarea {...props} />}</FormField>);
    expect(markup).toContain("(optional)");
    expect(markup).toContain('aria-invalid="false"');
    expect(markup).not.toContain("aria-describedby");
  });
});
