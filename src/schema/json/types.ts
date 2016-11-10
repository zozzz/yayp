import { Schema } from "../schema"
import { ScalarResolverAsType } from "../scalar"
import {
	ScalarToNull,
	ScalarToBool,
	ScalarToInt,
	ScalarToFloat,
	JsonScalars
} from "./scalars"


export const TAGS = {
	"tag:yaml.org,2002:null": new ScalarResolverAsType(ScalarToNull),
	"tag:yaml.org,2002:int": new ScalarResolverAsType(ScalarToInt),
	"tag:yaml.org,2002:float": new ScalarResolverAsType(ScalarToFloat),
	"tag:yaml.org,2002:bool": new ScalarResolverAsType(ScalarToBool),
}


export const JsonSchema = new Schema(TAGS, JsonScalars)