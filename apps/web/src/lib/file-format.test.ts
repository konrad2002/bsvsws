import { describe, expect, it } from "vitest";
import { fileFormat } from "./file-format";

describe("fileFormat", () => {
  it("maps formats like the SwimResults file list", () => {
    expect(fileFormat("PDF")).toEqual({ icon: "document", colorClass: "bg-file-pdf" });
    expect(fileFormat("dsv7")).toEqual({ icon: "data", colorClass: "bg-file-dsv" });
    expect(fileFormat("DSV8z")).toEqual({ icon: "archive", colorClass: "bg-file-dsv" });
    expect(fileFormat("lxf")).toEqual({ icon: "archive", colorClass: "bg-file-lenex" });
    expect(fileFormat("zip").colorClass).toBe("bg-file-zip");
    expect(fileFormat("docx")).toEqual({ icon: "file", colorClass: "bg-file-other" });
    expect(fileFormat(null).icon).toBe("file");
  });
});
