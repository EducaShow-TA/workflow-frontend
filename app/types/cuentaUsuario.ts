import type { RolUsuario } from '~/types/autenticacion'

export interface CuentaUsuario {
  id: number
  username: string
  rol: RolUsuario
  nombreCompleto: string
  dni: string
  activo?: boolean
  nombre?: string
  apellidoPaterno?: string
  apellidoMaterno?: string
}

export interface SolicitudCrearCuenta {
  dni: string
  nombre: string
  apellidoPaterno: string
  apellidoMaterno: string
  username: string
  password: string
  rol: RolUsuario
}

export interface SolicitudActualizarCuenta {
  nombre: string
  apellidoPaterno: string
  apellidoMaterno: string
  username: string
}

export interface FormularioCuenta extends Omit<SolicitudCrearCuenta, 'rol'> {
  rol: RolUsuario | ''
  confirmacionPassword: string
}

export type ErroresCuenta = Partial<Record<keyof FormularioCuenta, string>>

export type ErroresEdicion = Partial<Record<keyof SolicitudActualizarCuenta, string>>

export type FiltroRol = RolUsuario | 'TODOS'

export type FiltroEstadoCuenta = 'TODOS' | 'ACTIVOS' | 'INACTIVOS'

export interface ConteoEstadoCuentas {
  activos: number
  inactivos: number
}
