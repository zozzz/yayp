import { Loader } from "./loader"
import { YamlDocument } from "./document"


export type LoadOptions = {

}


export function load(data: string, options?: LoadOptions) {
	let loader = new Loader(YamlDocument)
	return loader.load(data)
}


export function loadFile(filePath: string, options?: LoadOptions) {
	let loader = new Loader(YamlDocument)
	return loader.loadFile(filePath)
}