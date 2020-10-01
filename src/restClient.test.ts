import Axios, { AxiosStatic, AxiosResponse, AxiosError } from 'axios'
import { request, isSuccess } from './restClient'
import { mock } from 'jest-mock-extended'
import { TodoistRequestError } from './types/errors'
import * as caseConverter from 'axios-case-converter'
import theoretically from 'jest-theories'
import { assertInstance } from './testUtils/asserts'

jest.mock('axios')

const DEFAULT_BASE_URI = 'https://someapi.com/'
const DEFAULT_ENDPOINT = 'endpoint'
const DEFAULT_AUTH_TOKEN = 'AToken'

const DEFAULT_HEADERS = {
    'Content-Type': 'application/json',
}

const AUTHORIZATION_HEADERS = {
    ...DEFAULT_HEADERS,
    Authorization: `Bearer ${DEFAULT_AUTH_TOKEN}`,
}

const DEFAULT_PAYLOAD = {
    someKey: 'someValue',
}

const DEFAULT_RESPONSE = mock<AxiosResponse>({
    data: DEFAULT_PAYLOAD,
})

const DEFAULT_ERROR_MESSAGE = 'There was an error'

const setupAxiosMock = (response = DEFAULT_RESPONSE) => {
    const axiosMock = Axios as jest.Mocked<typeof Axios>

    axiosMock.get.mockResolvedValue(response)
    axiosMock.post.mockResolvedValue(response)
    axiosMock.delete.mockResolvedValue(response)

    jest.spyOn(caseConverter, 'default').mockImplementation(() => axiosMock)
    return axiosMock
}

const setupAxiosMockWithError = (statusCode: number, responseData: unknown) => {
    const axiosMock = Axios as jest.Mocked<typeof Axios>
    const axiosError = mock<AxiosError>({
        message: DEFAULT_ERROR_MESSAGE,
        response: { status: statusCode, data: responseData },
    })

    const errorFunc = () => {
        throw axiosError
    }

    axiosMock.get.mockImplementation(errorFunc)
    axiosMock.post.mockImplementation(errorFunc)
    axiosMock.delete.mockImplementation(errorFunc)
    return axiosMock
}

describe('restClient', () => {
    let axiosMock: jest.Mocked<AxiosStatic>

    beforeEach(() => {
        axiosMock = setupAxiosMock()
    })

    test('request creates axios client with default headers', async () => {
        await request('GET', DEFAULT_BASE_URI, DEFAULT_ENDPOINT)

        expect(axiosMock.create).toBeCalledTimes(1)
        expect(axiosMock.create).toBeCalledWith({ headers: DEFAULT_HEADERS })
    })

    test('request adds authorization header to config if token is passed', async () => {
        await request('GET', DEFAULT_BASE_URI, DEFAULT_ENDPOINT, DEFAULT_AUTH_TOKEN)

        expect(axiosMock.create).toBeCalledTimes(1)
        expect(axiosMock.create).toBeCalledWith({ headers: AUTHORIZATION_HEADERS })
    })

    test('get calls axios with expected endpoint', async () => {
        await request('GET', DEFAULT_BASE_URI, DEFAULT_ENDPOINT, DEFAULT_AUTH_TOKEN)

        expect(axiosMock.get).toBeCalledTimes(1)
        expect(axiosMock.get).toBeCalledWith(DEFAULT_BASE_URI + DEFAULT_ENDPOINT, {
            params: undefined,
        })
    })

    test('get passes params to axios', async () => {
        await request(
            'GET',
            DEFAULT_BASE_URI,
            DEFAULT_ENDPOINT,
            DEFAULT_AUTH_TOKEN,
            DEFAULT_PAYLOAD,
        )

        expect(axiosMock.get).toBeCalledTimes(1)
        expect(axiosMock.get).toBeCalledWith(DEFAULT_BASE_URI + DEFAULT_ENDPOINT, {
            params: DEFAULT_PAYLOAD,
        })
    })

    test('get returns response from axios', async () => {
        const result = await request('GET', DEFAULT_BASE_URI, DEFAULT_ENDPOINT, DEFAULT_AUTH_TOKEN)

        expect(axiosMock.get).toBeCalledTimes(1)
        expect(result).toEqual(DEFAULT_RESPONSE)
    })

    test('post sends expected endpoint and payload to axios', async () => {
        await request(
            'POST',
            DEFAULT_BASE_URI,
            DEFAULT_ENDPOINT,
            DEFAULT_AUTH_TOKEN,
            DEFAULT_PAYLOAD,
        )

        expect(axiosMock.post).toBeCalledTimes(1)
        expect(axiosMock.post).toBeCalledWith(DEFAULT_BASE_URI + DEFAULT_ENDPOINT, DEFAULT_PAYLOAD)
    })

    test('post returns response from axios', async () => {
        const result = await request(
            'POST',
            DEFAULT_BASE_URI,
            DEFAULT_ENDPOINT,
            DEFAULT_AUTH_TOKEN,
            DEFAULT_PAYLOAD,
        )

        expect(axiosMock.post).toBeCalledTimes(1)
        expect(result).toEqual(DEFAULT_RESPONSE)
    })

    test('delete calls axios with expected endpoint', async () => {
        await request('DELETE', DEFAULT_BASE_URI, DEFAULT_ENDPOINT, DEFAULT_AUTH_TOKEN)

        expect(axiosMock.delete).toBeCalledTimes(1)
        expect(axiosMock.delete).toBeCalledWith(DEFAULT_BASE_URI + DEFAULT_ENDPOINT)
    })

    test('request throws TodoistRequestError on axios error with expected values', async () => {
        const statusCode = 403
        const responseData = 'Some Data'
        axiosMock = setupAxiosMockWithError(statusCode, responseData)

        expect.assertions(3)

        try {
            await request('GET', DEFAULT_BASE_URI, DEFAULT_ENDPOINT, DEFAULT_AUTH_TOKEN)
        } catch (e) {
            const requestError = e as TodoistRequestError
            expect(requestError.message).toEqual(DEFAULT_ERROR_MESSAGE)
            expect(requestError.httpStatusCode).toEqual(statusCode)
            expect(requestError.responseData).toEqual(responseData)
        }
    })

    test('TodoistRequestError reports isAuthenticationError for relevant status codes', () => {
        const statusCode = 403

        const requestError = new TodoistRequestError('An Error', statusCode, undefined)
        expect(requestError.isAuthenticationError()).toBeTruthy()
    })

    const responseStatusTheories = [
        { status: 100, isSuccess: false },
        { status: 200, isSuccess: true },
        { status: 299, isSuccess: true },
        { status: 300, isSuccess: false },
    ]

    theoretically(
        'isSuccess returns {isSuccess} for status code {status}',
        responseStatusTheories,
        (theory) => {
            const response = mock<AxiosResponse>({ status: theory.status })
            const success = isSuccess(response)
            expect(success).toEqual(theory.isSuccess)
        },
    )
})
