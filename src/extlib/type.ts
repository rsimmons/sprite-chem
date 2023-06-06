import { EVWrapper } from "./ev";

export type EVTypeId = string;

/**
 * EV TYPE MODULE INTERFACE
 *
 * A module that defines an EV type should have the following exports:
 * - the TS type of the underlying EV value (doesn't have a standard name)
 * - `typeId` of type `EVTypeId`
 * - `createDefault` of type `() => T`
 * - `serialize` of type `Serializer<T>`
 * - `deserialize` of type `Deserializer<T>`
 * - `getReferencedEVs` of type `(value: T) => ReadonlyArray<EVWrapper<any>>`
 *
 * These exports could be packaged into a single interface, but having them
 * separate lets us do tree shaking to allow for a smaller runtime build.
 */

// these could be defined to narrow things a bit, like:
// - https://github.com/microsoft/TypeScript/issues/1897
// - https://dev.to/ankittanna/how-to-create-a-type-for-complex-json-object-in-typescript-d81
export type SerializedValue = any; // probably JSON with certain allowed inline binary data

// this will only be called at devtime
export type Serializer<T> = (value: T, evToId: (ev: EVWrapper<any>) => string) => SerializedValue;

// this may be called at devtime or runtime
export type Deserializer<T> = (sv: SerializedValue, idToEv: (id: string) => EVWrapper<any>) => T;
