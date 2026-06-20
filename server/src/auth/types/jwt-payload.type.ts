export interface JwtPayload {
  sub: string;
  type: 'access';
}

export interface RefreshJwtPayload {
  sub: string;
  sid: string;
  type: 'refresh';
}
