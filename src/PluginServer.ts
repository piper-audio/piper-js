/**
 * Created by lucast on 30/08/2016.
 */
export interface Request {
    type: string,
    content?: any //TODO create a more meaningful type for this
}

export interface Request {
    type: string,
    success: boolean,
    errorText?: string,
    content?: any // TODO create a more meaningful type for this
}

