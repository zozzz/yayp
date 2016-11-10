
```typescript

class AbstractSchema {
	protected scalarDecision: {[key: int]: ScalarResolver}

	public constructor(public readonly tags, public readonly scalars: ScalarResolver[]) {

	}

	public resolveTag(qname: string): TypeFactory | null {

	}

	public resolveScalar(document: YamlDocument, value: Scalar): any | undefined {

	}
}






class TypeFactory {

}


class ScalarResolver extends TypeFactory {
	public constructor(public regex, public decision, public converter) {

	}

	public onScalar(value) {

	}
}
```