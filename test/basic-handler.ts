// import {IHandler, Mapping, Sequence, YamlDocument} from "../src/types"



// export class _BasicHandler implements IHandler {
// 	public newDocument() {

// 	}

// 	// private _refs = {}

// 	// public newMapping(): Mapping {
// 	// 	return {}
// 	// }

// 	// public setEntryOnMapping(obj: Mapping, key: any, value: any): boolean {
// 	// 	obj[key] = value
// 	// 	return true
// 	// }

// 	// public newSequence(): Sequence {
// 	// 	return []
// 	// }

// 	// public addEntryToSequence(seq: Sequence, value: any): boolean {
// 	// 	seq.push(value)
// 	// 	return true
// 	// }

// 	// public storeObjectReference(name: string, value: any): boolean {
// 	// 	this._refs[name] = value
// 	// 	return true
// 	// }

// 	// public getReferencedObject(name: string): any {
// 	// 	return this._refs[name]
// 	// }

// 	// public onTag(uri: string, value: any): any {

// 	// }

// 	// public onDirective(name: string, value: any): boolean {
// 	// 	return false
// 	// }

// 	public onError(fileName: string, lineNo: number, colNo: number, message: string): void {
// 		throw new Error(`${message} at ${fileName ? fileName + ":" : ""}${lineNo}-${colNo}`)
// 	}
// }

// export const BasicHandler = new _BasicHandler()