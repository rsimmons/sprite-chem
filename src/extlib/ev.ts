import { EVTypeId, SerializedValue } from "./type";

/**
 * EV WRAPPER
 *
 * EVs at runtime and devtime are wrapped in objects that present this interface,
 * parameterized by the type of the underlying value.
 *
 * These could be two separate interfaces (for runtime and devtime), but that
 * significantly complicated the type signatures of related interfaces. So instead,
 * devtime-only properties will throw "unimplemented" errors at runtime.
 */

export interface EVWrapper<T> {
  // available at runtime and devtime:
  readonly typeId: EVTypeId;
  value: T;

  // available only at devtime:
  readonly setValue: (newValue: T) => void;

  readonly getReferencedEVs: () => ReadonlyArray<EVWrapper<any>>;

  // subscribe to get notified when the underlying value changes
  readonly onValueChange: (notify: (value: T) => void) => void;
  readonly offValueChange: (notify: (value: T) => void) => void;

  // subscribe to get notified when the EV is deleted
  readonly onDeleted: (notify: () => void) => void;
  readonly offDeleted: (notify: () => void) => void;

  // TODO:
  // readonly serialize: (evToId: (ev: EVWrapper<any>) => string) => SerializedValue;
}

export function createRuntimeEVWrapper<T>(typeId: EVTypeId, value: T): EVWrapper<T> {
  return {
    typeId,
    value,
    setValue: (newValue: T) => { throw new Error('unimplemented'); },
    getReferencedEVs: () => { throw new Error('unimplemented'); },
    onValueChange: () => { throw new Error('unimplemented'); },
    offValueChange: () => { throw new Error('unimplemented'); },
    onDeleted: () => { throw new Error('unimplemented'); },
    offDeleted: () => { throw new Error('unimplemented'); },
  };
}

export function createDevtimeEVWrapper<T>(typeId: EVTypeId, value: T): EVWrapper<T> {
  const ev = {
    typeId,
    value,
    setValue: (newValue: T) => {
      ev.value = newValue;
      // TODO: notify listeners
    },
    // TODO: implement these below
    getReferencedEVs: () => { throw new Error('unimplemented'); },
    onValueChange: () => { throw new Error('unimplemented'); },
    offValueChange: () => { throw new Error('unimplemented'); },
    onDeleted: () => { throw new Error('unimplemented'); },
    offDeleted: () => { throw new Error('unimplemented'); },
  };
  return ev;
}
