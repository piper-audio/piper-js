/**
 * Created by lucas on 26/08/2016.
 */
import { Timestamp } from './Timestamp'

export interface Feature {
    timestamp?: Timestamp,
    duration?: Timestamp,
    label?: string,
    values?: Array<Number>,
    b64values?: string
}