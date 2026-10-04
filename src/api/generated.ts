// Generado desde contracts/openapi.json. Ejecutar npm run contract:sync.
export interface paths {
    "/api/v1/obras": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Consultar resúmenes de obras publicadas
         * @description Página consistente por obraId. Cada resultado identifica su revisión para abrir el detalle histórico aunque otra revisión se publique después. Sin bbox incluye obras con y sin ubicación aprobada; con bbox incluye una sola vez cada obra con al menos una ubicación aprobada que intersecta el área. bbox junto con tieneGeometria=false produce una página vacía. metadata.publicadoEn es la primera publicación de esa revisión; no es una fecha de actualización de la fuente.
         */
        get: operations["WorksController_list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/obras/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Consultar una obra y su procedencia publicada
         * @description Sin revisionId devuelve la revisión actual; con revisionId permite consultar una revisión de esa obra que haya sido publicada. Omite geometrías candidatas y archivos originales privados. metadata.publicadoEn corresponde a la primera publicación de la revisión consultada. Su contenido histórico es estable, pero publicadaActualmente y catalogoVersion reflejan el catálogo al consultar.
         */
        get: operations["WorksController_detail"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/obras/geojson": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Consultar ubicaciones aprobadas como GeoJSON
         * @description Una Feature por ubicación aceptada de la revisión actual, en orden obraId/ordinal. Point, MultiPoint, LineString, MultiLineString, Polygon y MultiPolygon en WGS84 [longitud,latitud]. Una obra puede tener varias Features. Se devuelve la geometría completa que intersecta bbox, sin simplificación ni recorte. Máximo 10 MiB por respuesta; no es un presupuesto de descarga móvil.
         */
        get: operations["WorksController_geojson"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        PublicApiError: {
            error: {
                code: string;
                details?: {
                    [key: string]: unknown;
                };
                message: string;
                requestId: string | null;
            };
        };
        PublicGeoFeatureCollection: {
            /** @description Versión decimal exacta del catálogo; conservar como string, nunca convertir a Number. */
            catalogoVersion: string;
            features: {
                geometry: {
                    coordinates: (number)[];
                    /** @enum {string} */
                    type: "Point";
                } | {
                    coordinates: (number)[][];
                    /** @enum {string} */
                    type: "MultiPoint";
                } | {
                    coordinates: (number)[][];
                    /** @enum {string} */
                    type: "LineString";
                } | {
                    coordinates: (number)[][][];
                    /** @enum {string} */
                    type: "MultiLineString";
                } | {
                    coordinates: (number)[][][];
                    /** @enum {string} */
                    type: "Polygon";
                } | {
                    coordinates: (number)[][][][];
                    /** @enum {string} */
                    type: "MultiPolygon";
                };
                /**
                 * Format: uuid
                 * @description Identificador de ubicación; una obra puede tener varias Features.
                 */
                id: string;
                properties: {
                    calidad: {
                        /** @enum {string} */
                        condicion: "ACCEPTED";
                        controles: string[];
                        crs: {
                            /** @enum {string} */
                            codigo: "EPSG:4326";
                            /** @enum {string} */
                            condicion: "REPORTED_REFERENCE";
                            /** @enum {string} */
                            fundamento: "CATALOG_METADATA";
                        } | {
                            /** @enum {string} */
                            codigo: "EPSG:4326";
                            /** @enum {string} */
                            condicion: "APPROVED_ASSUMPTION";
                            /** @enum {string} */
                            fundamento: "REVIEW_DECISION";
                        };
                        /** @enum {string} */
                        precision: "ubicacion_establecimiento_reportada" | "coordenada_reportada_sin_precision" | "geometria_reportada_sin_precision";
                    };
                    clasificaciones: {
                        codigo: string;
                        esquema: string;
                        etiqueta: string;
                    }[];
                    /** @enum {string|null} */
                    estado: "COMPLETED" | "IN_PROGRESS" | "OTHER_REPORTED" | null;
                    fuentes: {
                        /** @enum {string} */
                        codigo: "pba-edificios" | "caba-actualizado" | "nacion-obras" | "vl-obras";
                        /** Format: uuid */
                        recursoId: string;
                        sha256: string;
                        /** Format: uri */
                        urlCatalogo: string;
                    }[];
                    nombre: string;
                    /** Format: uuid */
                    obraId: string;
                    /** Format: uuid */
                    revisionId: string;
                    /** Format: uuid */
                    ubicacionId: string;
                };
                /** @enum {string} */
                type: "Feature";
            }[];
            nextCursor: string | null;
            /** @enum {string} */
            type: "FeatureCollection";
        };
        PublicWorkDetail: {
            atributosFuente?: {
                gestion: string | null;
                subfuente: string | null;
            };
            avanceFinanciero?: string | null;
            avanceFisico: string | null;
            calidadCampos: {
                [key: string]: {
                    /** @enum {string} */
                    estado: "KNOWN" | "NOT_REPORTED" | "NOT_APPLICABLE" | "INVALID" | "PENDING_REVIEW";
                    motivo?: string;
                };
            };
            /** @description Versión decimal exacta del catálogo; conservar como string, nunca convertir a Number. */
            catalogoVersion: string;
            clasificaciones: {
                codigo: string;
                esquema: string;
                etiqueta: string;
            }[];
            contratacion?: {
                ejercicio: string | null;
                expediente: string | null;
                numero: string | null;
                procedimiento: string | null;
            };
            educacion: {
                establecimientos: {
                    clave: string | null;
                    cui: string | null;
                    idFuente: string | null;
                    matricula: number | null;
                    nombre: string;
                    periodo: string | null;
                    regionEducativa: string | null;
                    /** @enum {string|null} */
                    tipoIntervencion: "CREACION" | "SUSTITUCION" | null;
                }[];
            };
            /** @enum {string|null} */
            estado: "COMPLETED" | "IN_PROGRESS" | "OTHER_REPORTED" | null;
            fechasInformadas: ({
                /** @enum {string} */
                campo: "inicio" | "fin";
                /** Format: date */
                diaCivil: string;
                /** @enum {string} */
                epoch: "1900" | "1904";
                estilo: string;
                /** @enum {string|null} */
                naturaleza: null;
                serial: string;
            } | {
                anio: string;
                /** @enum {string} */
                campo: "inicio" | "fin";
                /** @enum {string|null} */
                naturaleza: null;
                /** @enum {string} */
                precision: "YEAR";
            } | {
                /** @enum {string} */
                campo: "inicio" | "fin";
                /** Format: date */
                diaCivil: string;
                /** @enum {string|null} */
                naturaleza: null;
                /** @enum {string} */
                origen: "REVIEW_DECISION";
                /** @enum {string} */
                precision: "DAY";
            })[];
            fuentes: {
                /** @enum {string} */
                codigo: "pba-edificios" | "caba-actualizado" | "nacion-obras" | "vl-obras";
                /** Format: uuid */
                recursoId: string;
                sha256: string;
                /** Format: uri */
                urlCatalogo: string;
            }[];
            importes: ({
                /** @enum {string|null} */
                alcance: null;
                /** @enum {string|null} */
                base: null;
                /** @enum {string} */
                concepto: "MONTO_DEFINITIVO_REPORTADO";
                /** @enum {string|null} */
                moneda: null;
                valor: string;
            } | {
                /** @enum {string|null} */
                alcance: null;
                /** @enum {string|null} */
                base: null;
                /** @enum {string} */
                concepto: "MONTO_REPORTADO";
                /** @enum {string|null} */
                moneda: null;
                valor: string;
            } | {
                /** @enum {string|null} */
                alcance: null;
                /** @enum {string|null} */
                base: null;
                /** @enum {string} */
                concepto: "TOTAL_OBRA_REPORTADO";
                /** @enum {string|null} */
                moneda: "ARS" | "USD" | null;
                valor: string;
            })[];
            metadata: {
                /**
                 * Format: date-time
                 * @description Fecha de actualización de la fuente respaldada por evidencia. Actualmente null: los contratos vigentes no aportan una fecha unívoca; no se infiere de publicación, captura ni fechas de obra.
                 */
                fechaActualizacionFuente: string | null;
                /**
                 * Format: date-time
                 * @description Primera publicación de esta revisión en Obras Transparentes, en UTC. No es la aprobación, la captura ni la actualización de la fuente.
                 */
                publicadoEn: string;
            };
            municipal?: {
                areaResponsableReportada: string | null;
                estadoFuente: string | null;
                jurisdiccionReportada: string | null;
                lugarReportado: string | null;
                tipoFuente: string | null;
            };
            nacional?: {
                atributosFuente: {
                    accionClimatica: string | null;
                    contraparteCuit: string | null;
                    contraparteModalidad: string | null;
                    contraparteNombre: string | null;
                    contraparteRol: string | null;
                    odsIncidencia: string | null;
                };
                descripcion: string | null;
                duracionDias: number | null;
                estadoFuente: string | null;
                monedaFuente: string | null;
                objetivo: string | null;
                participantes: {
                    ejecutor: string | null;
                    financiadores: string[];
                };
                programaFuente: string | null;
                referencias: {
                    bapin: string | null;
                    idproyecto: string;
                    numeroObra: string | null;
                    operacionFinanciera: string | null;
                    perfilObra: string | null;
                };
                sectorFuente: string | null;
                territorio: {
                    codigoBahra: string | null;
                    departamento: string | null;
                    provincia: string | null;
                };
                tipoProyectoFuente: string | null;
            };
            nombre: string;
            numeroRevision: number;
            /** Format: uuid */
            obraId: string;
            participantes?: {
                cuit: string | null;
                jurisdiccionReportada: string | null;
                razonSocial: string | null;
            };
            procedencia: {
                [key: string]: {
                    evidencias: ({
                        columna: string;
                        localizador: {
                            byteEndExclusive: number;
                            byteStart: number;
                            dataOrdinal: number;
                            /** @enum {string} */
                            format: "CSV";
                            lineEnd: number;
                            lineStart: number;
                        } | {
                            cells: string[];
                            date1904: boolean;
                            /** @enum {string} */
                            format: "XLSX";
                            part: string;
                            row: number;
                            worksheet: string;
                        };
                        posicion: number;
                        /** Format: uuid */
                        recursoId: string;
                        /** Format: uuid */
                        registroOrigenId: string;
                        /** Format: uuid */
                        resultadoRegistroId: string;
                        /** @enum {string} */
                        tipo: "SOURCE_CELL";
                    } | {
                        clave: string;
                        /** Format: uuid */
                        recursoId: string;
                        referencia: {
                            /** Format: date-time */
                            consultadoEn: string;
                            sha256: string;
                            /** Format: uri */
                            url: string;
                            version: string;
                        };
                        /** @enum {string} */
                        tipo: "CATALOG_METADATA";
                        valor: string;
                    } | {
                        campo: string;
                        /** Format: uuid */
                        obraId: string;
                        /** Format: uuid */
                        revisionId: string;
                        /** @enum {string} */
                        tipo: "BASE_REVISION";
                    } | {
                        campo: string;
                        /** Format: uuid */
                        decisionId: string;
                        /** @enum {string} */
                        tipo: "REVIEW_DECISION";
                    })[];
                    regla: string;
                    version: string;
                };
            };
            programas: string[];
            /** @description Vigencia al consultar. Aunque revisionId fije el contenido, este campo y catalogoVersion pueden cambiar. */
            publicadaActualmente: boolean;
            /** Format: uuid */
            revisionId: string;
            /** @enum {string} */
            schemaVersion: "obra@1" | "obra@2";
            territorios: {
                codigo: string;
                /** @enum {string} */
                condicion: "REPORTED";
                /** @enum {string} */
                esquema: "pba.municipio" | "nacion.provincia" | "nacion.departamento";
                nombre: string;
            }[];
            ubicaciones: ({
                clave: string;
                /** @enum {string} */
                condicion: "ACCEPTED";
                controles: string[];
                crs: {
                    /** @enum {string} */
                    codigo: "EPSG:4326";
                    /** @enum {string} */
                    condicion: "REPORTED_REFERENCE";
                    /** @enum {string} */
                    fundamento: "CATALOG_METADATA";
                } | {
                    /** @enum {string} */
                    codigo: "EPSG:4326";
                    /** @enum {string} */
                    condicion: "APPROVED_ASSUMPTION";
                    /** @enum {string} */
                    fundamento: "REVIEW_DECISION";
                };
                direccionReportada?: {
                    calle: string | null;
                    numero: string | null;
                };
                geometria: {
                    coordinates: (number)[];
                    /** @enum {string} */
                    type: "Point";
                } | {
                    coordinates: (number)[][];
                    /** @enum {string} */
                    type: "MultiPoint";
                } | {
                    coordinates: (number)[][];
                    /** @enum {string} */
                    type: "LineString";
                } | {
                    coordinates: (number)[][][];
                    /** @enum {string} */
                    type: "MultiLineString";
                } | {
                    coordinates: (number)[][][];
                    /** @enum {string} */
                    type: "Polygon";
                } | {
                    coordinates: (number)[][][][];
                    /** @enum {string} */
                    type: "MultiPolygon";
                };
                /** @enum {string} */
                precision: "ubicacion_establecimiento_reportada" | "coordenada_reportada_sin_precision" | "geometria_reportada_sin_precision";
                /** Format: uuid */
                ubicacionId: string;
            } | {
                clave: string;
                /** @enum {string} */
                condicion: "PENDING_REVIEW" | "OMITTED" | "INVALID";
                controles: string[];
                crs: ({
                    /** @enum {string} */
                    codigo: "EPSG:4326";
                    /** @enum {string} */
                    condicion: "REPORTED_REFERENCE";
                    /** @enum {string} */
                    fundamento: "CATALOG_METADATA";
                } | {
                    /** @enum {string} */
                    codigo: "EPSG:4326";
                    /** @enum {string} */
                    condicion: "APPROVED_ASSUMPTION";
                    /** @enum {string} */
                    fundamento: "REVIEW_DECISION";
                }) | null;
                direccionReportada?: {
                    calle: string | null;
                    numero: string | null;
                };
                /** @enum {string|null} */
                geometria: null;
                /** @enum {string} */
                precision: "ubicacion_establecimiento_reportada" | "coordenada_reportada_sin_precision" | "geometria_reportada_sin_precision";
                /** @enum {string|null} */
                ubicacionId: null;
            })[];
        };
        PublicWorkListResponse: {
            /** @description Versión decimal exacta del catálogo; conservar como string, nunca convertir a Number. */
            catalogoVersion: string;
            items: components["schemas"]["PublicWorkSummary"][];
            limit: number;
            nextCursor: string | null;
        };
        PublicWorkSummary: {
            clasificaciones: {
                codigo: string;
                esquema: string;
                etiqueta: string;
            }[];
            /** @enum {string|null} */
            estado: "COMPLETED" | "IN_PROGRESS" | "OTHER_REPORTED" | null;
            fuentes: {
                /** @enum {string} */
                codigo: "pba-edificios" | "caba-actualizado" | "nacion-obras" | "vl-obras";
                /** Format: uuid */
                recursoId: string;
                sha256: string;
                /** Format: uri */
                urlCatalogo: string;
            }[];
            metadata: {
                /**
                 * Format: date-time
                 * @description Fecha de actualización de la fuente respaldada por evidencia. Actualmente null: los contratos vigentes no aportan una fecha unívoca; no se infiere de publicación, captura ni fechas de obra.
                 */
                fechaActualizacionFuente: string | null;
                /**
                 * Format: date-time
                 * @description Primera publicación de esta revisión en Obras Transparentes, en UTC. No es la aprobación, la captura ni la actualización de la fuente.
                 */
                publicadoEn: string;
            };
            nombre: string;
            numeroRevision: number;
            /** Format: uuid */
            obraId: string;
            programas: string[];
            /** Format: uuid */
            revisionId: string;
            territorios: {
                codigo: string;
                /** @enum {string} */
                condicion: "REPORTED";
                /** @enum {string} */
                esquema: "pba.municipio" | "nacion.provincia" | "nacion.departamento";
                nombre: string;
            }[];
            tieneGeometria: boolean;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    WorksController_list: {
        parameters: {
            query?: {
                /** @description west,south,east,north en WGS84; misma intersección espacial que GeoJSON. Opcional: sin él se conservan las obras sin ubicación aprobada. */
                bbox?: string;
                /** @description Cursor de la página anterior con los mismos filtros. catalogoVersion es un string decimal exacto. */
                cursor?: string;
                estado?: "COMPLETED" | "IN_PROGRESS" | "OTHER_REPORTED";
                fuente?: "pba-edificios" | "caba-actualizado" | "nacion-obras" | "vl-obras";
                limit?: number;
                /** @description Texto con ceros conservados, acompañado por territorioEsquema=pba.municipio. */
                municipioCodigo?: string;
                sector?: "educacion";
                /** @description Requerido junto con municipioCodigo. Código reportado por PBA; no implica equivalencia nacional. */
                territorioEsquema?: "pba.municipio";
                /** @description Presencia de una ubicación aprobada en la revisión publicada. */
                tieneGeometria?: "true" | "false";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description {items,nextCursor,limit,catalogoVersion}; obras con y sin ubicaciones aceptadas. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicWorkListResponse"];
                };
            };
            /** @description CATALOG_CHANGED: reiniciar sin cursor porque hubo una publicación entre páginas. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicApiError"];
                };
            };
            /** @description Filtros, combinación territorial, límite o cursor no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicApiError"];
                };
            };
            /** @description Error interno sin detalles privados. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicApiError"];
                };
            };
        };
    };
    WorksController_detail: {
        parameters: {
            query?: {
                revisionId?: string;
            };
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Snapshot público validado, ubicaciones y procedencia por campo; catalogoVersion como string decimal. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicWorkDetail"];
                };
            };
            /** @description Obra o revisión sin publicación accesible. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicApiError"];
                };
            };
            /** @description Identificador o parámetros inválidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicApiError"];
                };
            };
            /** @description Error interno sin detalles privados. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicApiError"];
                };
            };
        };
    };
    WorksController_geojson: {
        parameters: {
            query: {
                /** @description west,south,east,north en WGS84; finitos y crecientes, sin cruce del antimeridiano. */
                bbox: string;
                /** @description Cursor de la página anterior con los mismos filtros. catalogoVersion es un string decimal exacto. */
                cursor?: string;
                estado?: "COMPLETED" | "IN_PROGRESS" | "OTHER_REPORTED";
                fuente?: "pba-edificios" | "caba-actualizado" | "nacion-obras" | "vl-obras";
                limit?: number;
                /** @description Texto con ceros conservados, acompañado por territorioEsquema=pba.municipio. */
                municipioCodigo?: string;
                sector?: "educacion";
                /** @description Requerido junto con municipioCodigo. Código reportado por PBA; no implica equivalencia nacional. */
                territorioEsquema?: "pba.municipio";
                /** @description Presencia de una ubicación aprobada en la revisión publicada. */
                tieneGeometria?: "true" | "false";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description FeatureCollection con nextCursor y catalogoVersion. Las obras sin geometría se consultan en el listado. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicGeoFeatureCollection"];
                };
            };
            /** @description CATALOG_CHANGED: reiniciar sin cursor porque hubo una publicación entre páginas. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicApiError"];
                };
            };
            /**
             * @description bbox inválido o BBOX_TOO_BROAD al exceder 10 MiB: reducir bbox/limit.
             *
             *     Filtros, combinación territorial, límite o cursor no válidos.
             */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicApiError"];
                };
            };
            /** @description Error interno sin detalles privados. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicApiError"];
                };
            };
        };
    };
}
