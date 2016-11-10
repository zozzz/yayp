import { SchemaCollection } from "../collection"
import { V12Schema } from "./types"
import { SCHEMA_FAILSAFE } from "../failsafe"


export const SCHEMA_V12 = new SchemaCollection([SCHEMA_FAILSAFE, V12Schema])