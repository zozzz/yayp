import { SchemaCollection } from "../collection"
import { JsonSchema } from "./types"
import { SCHEMA_FAILSAFE } from "../failsafe"


export const SCHEMA_JSON = new SchemaCollection([SCHEMA_FAILSAFE, JsonSchema])