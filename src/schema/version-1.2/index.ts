import { SchemaCollection } from "../collection"
import { V12Schema } from "./types"
import { SCHEMA_COMMON } from "../basic"


export const SCHEMA_V12 = new SchemaCollection([SCHEMA_COMMON, V12Schema])