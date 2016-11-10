import { Schema } from "../schema"
import { ScalarResolverAsType } from "../scalar"
import {
	ScalarToNull,
	ScalarToBool,
	ScalarToInt,
	ScalarToFloat,
	ScalarToDate,
	V12Scalars
} from "./scalars"


export const TAGS = {
	"tag:yaml.org,2002:null": new ScalarResolverAsType(ScalarToNull),
	"tag:yaml.org,2002:int": new ScalarResolverAsType(ScalarToInt),
	"tag:yaml.org,2002:float": new ScalarResolverAsType(ScalarToFloat),
	"tag:yaml.org,2002:bool": new ScalarResolverAsType(ScalarToBool),
	"tag:yaml.org,2002:timestamp": new ScalarResolverAsType(ScalarToDate),
}


export const V12Schema = new Schema(TAGS, V12Scalars)