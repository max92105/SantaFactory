export type ToyTypeDef = {
  id: string;
  name: string;
  icon: string;
  baseSellValue: number;
};

export const toyTypes: ToyTypeDef[] = [
  { id: "plushy", name: "Plushy", icon: "🧸", baseSellValue: 3.0 },
  { id: "rubik", name: "Rubik's Cube", icon: "🟩", baseSellValue: 8.0 },
];

export function getToyType(id: string): ToyTypeDef | undefined {
  return toyTypes.find((t) => t.id === id);
}
