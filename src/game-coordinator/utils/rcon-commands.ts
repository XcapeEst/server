export function addGamePlayer(
  steamId: string,
  name: string,
  team: string,
  gameClass: string,
) {
  return [
    `sm_game_player_add ${steamId}`,
    `-name "${name}"`,
    `-team ${team}`,
    `-class ${gameClass}`,
  ].join(' ');
}

export function changelevel(map: string) {
  return `changelevel ${map}`;
}

export function delAllGamePlayers() {
  return 'sm_game_player_delall';
}

export function delGamePlayer(steamId: string) {
  return `sm_game_player_del ${steamId}`;
}

export function enablePlayerWhitelist() {
  return 'sm_game_player_whitelist 1';
}

export function disablePlayerWhitelist() {
  return 'sm_game_player_whitelist 0';
}

export function execConfig(config: string) {
  return `exec ${config}`;
}

export function kickAll() {
  return 'kickall';
}

export function svLogsecret(logSecret = '0') {
  return `sv_logsecret ${logSecret}`;
}

export function logAddressAdd(logAddress: string) {
  return `logaddress_add ${logAddress}`;
}

export function logAddressDel(logAddress: string) {
  return `logaddress_del ${logAddress}`;
}

export function logsTfTitle(logsTfTitle: string) {
  return `logstf_title ${logsTfTitle}`;
}

export function logsTfAutoupload(upload: number) {
  // Set to 2 to upload logs from all matches. (default)\n - Set to 1 to upload logs from matches with at least 4 players.\n - Set to 0 to disable automatic upload. Admins can still upload logs by typing !ul
  return `logstf_autoupload ${upload}`;
}

export function setPassword(password: string) {
  return `sv_password ${password}`;
}

export function tftrueWhitelistId(whitelistId: string) {
  return `tftrue_whitelist_id ${whitelistId}`;
}

export function tvPort(port?: string) {
  return `tv_port ${port || ''}`;
}

export function tvPassword(password?: string) {
  return `tv_password ${password || ''}`;
}

export function say(message: string) {
  return `say ${message}`;
}
