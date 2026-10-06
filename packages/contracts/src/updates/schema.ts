import { Static, Type } from '@sinclair/typebox';

export const ReleaseAssetKindSchema = Type.Union([
  Type.Literal('appimage'),
  Type.Literal('deb'),
  Type.Literal('nsis'),
]);

export const ReleasePlatformSchema = Type.Object(
  {
    os: Type.Union([Type.Literal('linux'), Type.Literal('windows')]),
    arch: Type.Union([Type.Literal('x64'), Type.Literal('arm64')]),
    asset: Type.String({ minLength: 1 }),
    sha256: Type.String({ pattern: '^[a-f0-9]{64}$' }),
    kind: ReleaseAssetKindSchema,
  },
  { additionalProperties: false },
);
export type ReleasePlatform = Static<typeof ReleasePlatformSchema>;

export const ReleaseCompatibilitySchema = Type.Object(
  {
    profileSchemaVersion: Type.Integer({ minimum: 0 }),
    projectSchemaVersion: Type.Integer({ minimum: 0 }),
    minUpgradeFromVersion: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);
export type ReleaseCompatibility = Static<typeof ReleaseCompatibilitySchema>;

export const ReleaseManifestSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    version: Type.String({ minLength: 1 }),
    tag: Type.String({ minLength: 1 }),
    commit: Type.String({ minLength: 1 }),
    builtAt: Type.String({ format: 'date-time' }),
    platforms: Type.Array(ReleasePlatformSchema, { minItems: 1 }),
    compatibility: ReleaseCompatibilitySchema,
    notes: Type.String(),
  },
  { additionalProperties: false },
);
export type ReleaseManifest = Static<typeof ReleaseManifestSchema>;

export const UpdateAssetSchema = Type.Object(
  {
    name: Type.String({ minLength: 1 }),
    url: Type.String({ format: 'uri' }),
    bytes: Type.Integer({ minimum: 0 }),
    sha256: Type.String({ pattern: '^[a-f0-9]{64}$' }),
    kind: ReleaseAssetKindSchema,
  },
  { additionalProperties: false },
);
export type UpdateAsset = Static<typeof UpdateAssetSchema>;

export const UpdateAvailableSchema = Type.Object(
  {
    version: Type.String({ minLength: 1 }),
    tag: Type.String({ minLength: 1 }),
    notes: Type.String(),
    asset: UpdateAssetSchema,
    manifest: ReleaseManifestSchema,
  },
  { additionalProperties: false },
);
export type UpdateAvailable = Static<typeof UpdateAvailableSchema>;

export const UpdateVerificationSchema = Type.Object(
  {
    sha256: Type.Boolean(),
    signature: Type.Union([
      Type.Literal('verified'),
      Type.Literal('failed'),
      Type.Literal('unavailable'),
    ]),
  },
  { additionalProperties: false },
);

export const DownloadedUpdateSchema = Type.Object(
  {
    version: Type.String({ minLength: 1 }),
    path: Type.String({ minLength: 1 }),
    verified: UpdateVerificationSchema,
  },
  { additionalProperties: false },
);
export type DownloadedUpdate = Static<typeof DownloadedUpdateSchema>;

export const UpdateCompatibilitySchema = Type.Object(
  { ok: Type.Boolean(), reasons: Type.Array(Type.String()) },
  { additionalProperties: false },
);

export const PreviousUpdateSchema = Type.Object(
  {
    version: Type.String({ minLength: 1 }),
    path: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export const UpdateStateSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    currentVersion: Type.String({ minLength: 1 }),
    channel: Type.Literal('stable'),
    lastCheckedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
    available: Type.Union([UpdateAvailableSchema, Type.Null()]),
    downloaded: Type.Union([DownloadedUpdateSchema, Type.Null()]),
    compatibility: UpdateCompatibilitySchema,
    previous: Type.Union([PreviousUpdateSchema, Type.Null()]),
    error: Type.Union([Type.String(), Type.Null()]),
  },
  { additionalProperties: false },
);
export type UpdateState = Static<typeof UpdateStateSchema>;

export const VerifiedUpdatePackageSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    version: Type.String({ minLength: 1 }),
    path: Type.String({ minLength: 1 }),
    sha256: Type.String({ pattern: '^[a-f0-9]{64}$' }),
    verified: UpdateVerificationSchema,
  },
  { additionalProperties: false },
);
export type VerifiedUpdatePackage = Static<typeof VerifiedUpdatePackageSchema>;

export const InstallerHandoffSchema = Type.Object(
  { descriptorPath: Type.String(), version: Type.String() },
  { additionalProperties: false },
);
