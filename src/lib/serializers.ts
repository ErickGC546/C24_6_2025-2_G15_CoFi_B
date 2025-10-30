export function safeSerialize(data: unknown) {
  // Convierte BigInt a string para evitar errores en JSON.stringify
  return JSON.parse(
    JSON.stringify(data, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
}

export default safeSerialize;
