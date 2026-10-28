import { readFile } from "node:fs/promises";
import path from "node:path";
import Viewer from "@/components/viewer";

export default async function Home() {
  "use cache";
  const example = await readFile(path.join(process.cwd(), "aa.md"), "utf8");
  return <Viewer example={example} />;
}
