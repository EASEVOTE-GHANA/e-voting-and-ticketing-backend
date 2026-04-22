import fs from "fs";
import path from "path";

export class TemplateHelper {
  private static templatesDir = path.join(__dirname, "../templates/emails");

  static render(templateName: string, variables: Record<string, any> = {}): string {
    const layoutPath = path.join(this.templatesDir, "layout.html");
    const templatePath = path.join(this.templatesDir, `${templateName}.html`);

    if (!fs.existsSync(layoutPath)) {
      throw new Error(`Layout not found: ${layoutPath}`);
    }
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found: ${templatePath}`);
    }

    let layoutContent = fs.readFileSync(layoutPath, "utf8");
    let templateContent = fs.readFileSync(templatePath, "utf8");

    // Replace placeholders in template
    templateContent = this.replacePlaceholders(templateContent, variables);

    // Inject template into layout
    let finalHtml = layoutContent.replace("{{content}}", templateContent);

    // Replace placeholders in layout (for header/footer)
    finalHtml = this.replacePlaceholders(finalHtml, variables);

    return finalHtml;
  }

  private static replacePlaceholders(content: string, variables: Record<string, any>): string {
    let result = content;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = new RegExp(`{{${key}}}`, "g");
      result = result.replace(placeholder, value !== undefined && value !== null ? String(value) : "");
    }
    return result;
  }
}
