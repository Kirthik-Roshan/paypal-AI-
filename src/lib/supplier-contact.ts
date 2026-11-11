// Normalize presentation punctuation only; never guess a country code.
export function normalizeSupplierPhone(phone: string) {
  return phone.replace(/[\s()-]/g, "");
}
export function supplierContactIssue(supplier: {
  name: string;
  phone: string;
  email: string;
}) {
  if (supplier.name.trim().length < 2)
    return {
      field: "name",
      message: "Enter a supplier name with at least 2 characters.",
    };
  if (
    supplier.phone &&
    !/^\+[1-9]\d{7,14}$/.test(normalizeSupplierPhone(supplier.phone))
  )
    return {
      field: "phone",
      message:
        "Add the country code, starting with +. For an Indian number, enter +91 followed by the 10-digit number.",
    };
  if (
    supplier.email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supplier.email.trim())
  )
    return {
      field: "email",
      message: "Enter a valid supplier email address or leave it blank.",
    };
  return null;
}
