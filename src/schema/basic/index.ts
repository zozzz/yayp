import { SchemaCollection } from "../collection"
import { SCHEMA_FAILSAFE, CommonTypes } from "./types"

export { SCHEMA_FAILSAFE }

export const SCHEMA_COMMON = new SchemaCollection([SCHEMA_FAILSAFE, CommonTypes])