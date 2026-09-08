import { writeFileSync } from "node:fs";
import {
  packJsonSchema,
  backupJsonSchema,
} from "../src/features/portability/validation";
writeFileSync(
  "study-generator/study-pack.schema.json",
  JSON.stringify(packJsonSchema, null, 2) + "\n",
);
writeFileSync(
  "src/db/backup.schema.json",
  JSON.stringify(backupJsonSchema, null, 2) + "\n",
);
