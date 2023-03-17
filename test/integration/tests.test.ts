import * as contentful from '../../lib/contentful'
import { ValidationError } from '../../lib/utils/validation-error'
import { localeSpaceParams, params, previewParams } from './utils'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const version = require('../../package.json').version

if (process.env.API_INTEGRATION_TESTS) {
  params.host = '127.0.0.1:5000'
  params.insecure = true
}

const client = contentful.createClient(params)
const previewClient = contentful.createClient(previewParams)
const localeClient = contentful.createClient(localeSpaceParams)

const responseLoggerStub = jest.fn()
const requestLoggerStub = jest.fn()
const clientWithLoggers = contentful.createClient({
  ...params,
  // @ts-ignore
  responseLogger: responseLoggerStub,
  requestLogger: requestLoggerStub,
})

const now = () => Math.floor(Date.now() / 1000)
const withExpiryIn1Hour = () => now() + 60 * 60
const withExpiryIn48Hours = () => now() + 48 * 60 * 60

test('Gets space', async () => {
  const response = await client.getSpace()
  expect(response.sys).toBeDefined()
  expect(response.name).toBeDefined()
  expect(response.locales).toBeDefined()
})

test('Gets content type', async () => {
  const response = await client.getContentType('1t9IbcfdCk6m04uISSsaIK')
  expect(response.sys).toBeDefined()
  expect(response.name).toBeDefined()
  expect(response.fields).toBeDefined()
})

test('Gets content types', async () => {
  const response = await client.getContentTypes()
  expect(response.items).toBeDefined()
})

test('Gets a content type that has resource links', async () => {
  const response = await client.getContentType('catalog')

  expect(response.sys).toBeDefined()
  expect(response.name).toBeDefined()
  expect(response.fields).toBeDefined()
  expect(response.fields).toEqual([
    {
      id: 'items',
      name: 'items',
      type: 'Array',
      localized: false,
      required: false,
      disabled: false,
      omitted: false,
      allowedResources: [
        {
          type: 'Contentful:Entry',
          source: 'crn:contentful:::content:spaces/ocrd5ofpzqgz',
          contentTypes: ['manufacturer', 'product'],
        },
      ],
      items: { type: 'ResourceLink', validations: [] },
    },
    {
      id: 'productOfTheMonth',
      name: 'product of the month',
      type: 'ResourceLink',
      localized: false,
      required: false,
      disabled: false,
      omitted: false,
      allowedResources: [
        {
          type: 'Contentful:Entry',
          source: 'crn:contentful:::content:spaces/ocrd5ofpzqgz',
          contentTypes: ['product'],
        },
      ],
    },
  ])
})

test('Gets content types with search query', async () => {
  const response = await client.getContentTypes({ query: 'cat' })
  expect(response.items).toHaveLength(2)
})

test('Gets entries', async () => {
  const response = await client.getEntries()

  expect(response.items).toBeDefined()
})
test('Gets entries with select', async () => {
  type Fields = {
    name: string
    likes: string
    color: string
  }

  const response = await client.getEntries<Fields>({
    select: ['fields.name', 'fields.likes'],
    content_type: 'cat',
  })

  expect(response.items).toBeDefined()
  expect(response.items[0].fields.name).toBeDefined()
  expect(response.items[0].fields.likes).toBeDefined()
  expect(response.items[0].fields.color).toBeUndefined()
})

test('Gets entries with a specific locale', async () => {
  const response = await client.getEntries({ locale: 'tlh' })

  expect(response.items[0].sys.locale).toBe('tlh')
  expect(response.items).toBeDefined()
})

test('Gets entries with a limit parameter', async () => {
  const response = await client.getEntries({
    limit: 2,
  })

  expect(response.items).toBeDefined()
  expect(response.items).toHaveLength(2)
})

test('Gets entries with a skip parameter', async () => {
  const response = await client.getEntries({
    skip: 2,
  })

  expect(response.items).toBeDefined()
  expect(response.skip).toBe(2)
})

test('Gets entries with linked includes', async () => {
  const response = await client.getEntries({ include: 2, 'sys.id': 'nyancat' })

  expect(response.includes).toBeDefined()
  expect(response.includes!.Asset).toBeDefined()
  expect(Object.keys(response.includes!.Asset!).length).toBeGreaterThan(0)
  expect(response.items[0].fields.bestFriend.sys.type).toEqual('Entry')
  expect(response.items[0].fields.bestFriend.fields).toBeDefined()
})

test('Gets entries with link resolution and includes, does not consider global `removeUnresolved` option', async () => {
  const removeUnresolvedClient = contentful.createClient({
    ...params,
    removeUnresolved: true,
  })
  const response = await removeUnresolvedClient.getEntries({
    'sys.id': '4SEhTg8sYJ1H3wDAinzhTp',
    include: 2,
  })
  expect(response.items[0].fields).toBeDefined()
  expect(response.items[0].fields.bestFriend).toMatchObject({
    sys: {
      type: 'Link',
      linkType: 'Entry',
      id: '6SiPbntBPYYjnVHmipxJBF',
    },
  })
})

test('Gets entries with content type query param', async () => {
  const response = await client.getEntries({ content_type: 'cat' })

  expect(response.total).toBe(4)
  expect(response.items.map((item) => item.sys.contentType.sys.id)).toEqual([
    'cat',
    'cat',
    'cat',
    'cat',
  ])
})

test('Gets entries with equality query', async () => {
  const response = await client.getEntries({ 'sys.id': 'nyancat' })

  expect(response.total).toBe(1)
  expect(response.items[0].sys.id).toBe('nyancat')
})

test('Gets entries with inequality query', async () => {
  const response = await client.getEntries({ 'sys.id[ne]': 'nyancat' })
  expect(response.total).toBeGreaterThan(0)
  expect(response.items.filter((item) => item.sys.id === 'nyancat')).toHaveLength(0)
})

test('Gets entries with array equality query', async () => {
  const response = await client.getEntries({
    content_type: 'cat',
    'fields.likes': 'lasagna',
  })

  expect(response.total).toBe(1)
  expect(response.items[0].fields.likes.filter((i) => i === 'lasagna')).toHaveLength(1)
})

test('Gets entries with array inequality query', async () => {
  const response = await client.getEntries({
    content_type: 'cat',
    'fields.likes[ne]': 'lasagna',
  })

  expect(response.total).toBeGreaterThan(0)
  expect(response.items[0].fields.likes.filter((i) => i === 'lasagna')).toHaveLength(0)
})

test('Gets entries with inclusion query', async () => {
  const response = await client.getEntries({ 'sys.id[in]': ['finn', 'jake'] })

  expect(response.total).toBe(2)
  expect(response.items.filter((item) => item.sys.id === 'finn')).toHaveLength(1)
  expect(response.items.filter((item) => item.sys.id === 'jake')).toHaveLength(1)
})

test('Gets entries with exclusion query', async () => {
  const response = await client.getEntries({
    content_type: 'cat',
    'fields.likes[nin]': 'rainbows,lasagna',
  })

  expect(response.total).toBeGreaterThan(0)
  expect(response.items[0].fields.likes.filter((i) => i === 'lasagna')).toHaveLength(0)
  expect(response.items[0].fields.likes.filter((i) => i === 'rainbow')).toHaveLength(0)
})

test('Gets entries with exists query', async () => {
  const response = await client.getEntries({
    content_type: 'cat',
    'fields.likes[exists]': 'true',
  })
  expect(response.items.filter((item) => item.fields.likes)).toHaveLength(response.total)
})

test('Gets entries with inverse exists query', async () => {
  const response = await client.getEntries({
    content_type: 'cat',
    'fields.likes[exists]': 'false',
  })
  expect(response.items.filter((item) => item.fields.likes)).toHaveLength(0)
})

test('Gets entries with field link query', async () => {
  const response = await client.getEntries({
    content_type: 'cat',
    'fields.bestFriend.sys.id': 'happycat',
  })

  expect(response.items[0].sys.id).toEqual('nyancat')
})

test('Gets entries with gte range query', async () => {
  const response = await client.getEntries({
    'sys.updatedAt[gte]': '2013-01-01T00:00:00Z',
  })

  expect(response.total).toBeGreaterThan(0)
})

test('Gets entries with lte range query', async () => {
  const response = await client.getEntries({
    'sys.updatedAt[lte]': '2013-01-01T00:00:00Z',
  })

  expect(response.total).toBe(0)
})

test('Gets entries with full text search query', async () => {
  const response = await client.getEntries({
    query: 'bacon',
  })

  expect(response.items[0].fields.description).toMatch(/bacon/)
})

test('Gets entries with full text search query on field', async () => {
  const response = await client.getEntries({
    content_type: 'dog',
    'fields.description[match]': 'bacon pancakes',
  })

  expect(response.items[0].fields.description).toMatch(/bacon pancakes/)
})

test('Gets entries with location proximity search', async () => {
  const response = await client.getEntries({
    content_type: '1t9IbcfdCk6m04uISSsaIK',
    'fields.center[near]': [38, -122],
  })

  expect(response.items[0].fields.center.lat).toBeDefined()
  expect(response.items[0].fields.center.lon).toBeDefined()
})

test('Gets entries with location in bounding object', async () => {
  const response = await client.getEntries({
    content_type: '1t9IbcfdCk6m04uISSsaIK',
    'fields.center[within]': '40,-124,36,-120',
  })

  const lat = response.items[0].fields.center.lat
  const lon = response.items[0].fields.center.lon

  expect(lat).toBeDefined()
  expect(lat).toBeGreaterThan(36)
  expect(lat).toBeLessThan(40)

  expect(lon).toBeDefined()
  expect(lon).toBeGreaterThan(-124)
  expect(lon).toBeLessThan(-120)
})

test('Gets entries by creation order', async () => {
  const response = await client.getEntries({
    order: 'sys.createdAt',
  })

  expect(new Date(response.items[0].sys.createdAt).getTime()).toBeLessThan(
    new Date(response.items[1].sys.createdAt).getTime()
  )
})

test('Gets entries by inverse creation order', async () => {
  const response = await client.getEntries({
    order: '-sys.createdAt',
  })

  expect(new Date(response.items[0].sys.createdAt).getTime()).toBeGreaterThan(
    new Date(response.items[1].sys.createdAt).getTime()
  )
})

/**
 * This test checks if entries can be ordered by two properties. The first
 * property (in this case content type id) takes priority. The test checks if two
 * entries with the same content type are ordered by the second property, id.
 * It also checks if the entry which comes before these has a lower id.
 *
 * It's a slightly fragile test as it can break if entries are added or deleted
 * from the space.
 */
test('Gets entries by creation order and id order', async () => {
  const response = await client.getEntries({
    order: 'sys.contentType.sys.id,sys.id',
  })

  const contentTypeOrder = response.items
    .map((item) => item.sys.contentType.sys.id)
    .filter((value, index, self) => self.indexOf(value) === index)

  expect(contentTypeOrder).toEqual([
    '1t9IbcfdCk6m04uISSsaIK',
    'cat',
    'catalog',
    'contentTypeWithMetadataField',
    'dog',
    'human',
    'kangaroo',
    'testEntryReferences',
  ])
  expect(response.items[0].sys.id < response.items[1].sys.id).toBeTruthy()
})

test('Gets assets with only images', async () => {
  const response = await client.getAssets({
    mimetype_group: 'image',
  })
  expect(response.items[0].fields.file?.contentType).toMatch(/image/)
})

test('Gets asset', async () => {
  const response = await client.getAsset('1x0xpXu4pSGS4OukSyWGUK')
  expect(response.sys).toBeDefined()
  expect(response.fields).toBeDefined()
})

test('Gets assets', async () => {
  const response = await client.getAssets()
  expect(response.items).toBeDefined()
  expect(response.items.length).toBeGreaterThan(0)
})

test('Gets Locales', async () => {
  const response = await client.getLocales()
  expect(response.items).toBeDefined()
  expect(response.items[0].code).toBe('en-US')
})

test('Gets tag', async () => {
  const response = await client.getTag('publicTag1')
  expect(response.sys).toBeDefined()
  expect(response.name).toBeDefined()
  expect(response.name).toEqual('public tag 1')
})

test('Gets tags', async () => {
  const response = await client.getTags()
  expect(response.items).toBeDefined()
  const publicTag = response.items.find((tag) => tag.sys.id === 'publicTag1')
  expect(publicTag).toBeDefined()
  expect(publicTag?.name).toEqual('public tag 1')
})

test('Gets entries with linked includes with all locales using the withAllLocales client chain modifier', async () => {
  const response = await client.withAllLocales.getEntries({
    include: 5,
    'sys.id': 'nyancat',
  })
  assertLocalizedEntriesResponse(response)
})

test('Gets entries with linked includes with all locales using withAllLocales client modifier in preview', async () => {
  const response = await previewClient.withAllLocales.getEntries({
    include: 5,
    'sys.id': 'nyancat',
  })
  assertLocalizedEntriesResponse(response)
})

test('Logs request and response with custom loggers', async () => {
  await clientWithLoggers.getEntries()
  expect(responseLoggerStub).toHaveBeenCalledTimes(1)
  expect(requestLoggerStub).toHaveBeenCalledTimes(1)
})

describe('Metadata', () => {
  test('Gets entries with attached metadata and field called "metadata" on preview', async () => {
    const response = await previewClient.getEntries()

    expect(response.items).toBeDefined()
    expect(response.items.filter(({ fields }) => fields.metadata).length).toBeGreaterThan(0)
    expect(response.items.filter(({ fields }) => fields.metadata)[0].metadata).toBeDefined()
  })
})

describe('Embargoed Assets', () => {
  test('Creates asset key on CDA', async () => {
    const response = await client.createAssetKey(withExpiryIn48Hours())
    expect(response.policy).toBeDefined()
    expect(response.secret).toBeDefined()
  })

  test('Creates asset key on CDA with a different lifetime', async () => {
    const response = await client.createAssetKey(withExpiryIn1Hour())
    expect(response.policy).toBeDefined()
    expect(response.secret).toBeDefined()
  })

  test('Creates asset key on CPA', async () => {
    const response = await previewClient.createAssetKey(withExpiryIn48Hours())
    expect(response.policy).toBeDefined()
    expect(response.secret).toBeDefined()
  })

  test('Does not create asset key if feature is not enabled', async () => {
    await expect(localeClient.createAssetKey(withExpiryIn48Hours())).rejects.toThrowError()
  })

  test('Does not create asset key if no/undefined expiresAt is given', async () => {
    // @ts-ignore
    await expect(localeClient.createAssetKey()).rejects.toThrow(ValidationError)
  })

  test('Does not create asset key if invalid expiresAt is given', async () => {
    // @ts-ignore
    await expect(localeClient.createAssetKey('invalidExpiresAt')).rejects.toThrow(ValidationError)
  })

  test('Does not create asset key if expiresAt is in the past', async () => {
    const shortExpiresAt = now() - 60
    await expect(localeClient.createAssetKey(shortExpiresAt)).rejects.toThrow(ValidationError)
  })

  test('Does not create asset key if expiresAt is too far in the future (> 48 hours)', async () => {
    const longExpiresAt = now() + 72 * 60 * 60
    await expect(localeClient.createAssetKey(longExpiresAt)).rejects.toThrow(ValidationError)
  })
})

test('Client object exposes current version', async () => {
  expect(client.version).toEqual(version)
})

// Assertion helpers
function assertLocalizedEntriesResponse(response) {
  expect(response.includes).toBeDefined()
  expect(response.includes!.Asset).toBeDefined()
  expect(Object.keys(response.includes!.Asset!).length).toBeGreaterThan(0)
  expect(response.items[0].fields.bestFriend['en-US'].fields).toBeDefined()
  expect(response.items[0].fields.bestFriend['en-US'].sys.type).toBe('Entry')
  expect(response.items[0].metadata).toEqual({ tags: [] })
}
