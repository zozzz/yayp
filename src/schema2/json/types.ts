import { Schema } from "../schema"
import { ScalarResolverAsType } from "../scalar"
import { ScalarToNull, JsonScalars } from "./scalar"


export const TAGS = {
	"tag:yaml.org,2002:null": new ScalarResolverAsType(ScalarToNull)
}


export const JsonSchema = new Schema(TAGS, JsonScalars)