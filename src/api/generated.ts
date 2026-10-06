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
    "/api/v1/organizaciones-institucionales": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Consultar organizaciones con roles verificados publicados
         * @description Lectura anónima sin parámetros. Catálogo completo de identidades referidas por roles VERIFIED en revisiones actualmente publicadas; máximo 1000 identidades y 512 KiB. Si excede el presupuesto responde 503, sin truncar. La ausencia de una institución no demuestra ausencia de actividad. No requiere sesión, permisos, Origin o CSRF.
         */
        get: operations["PublicInstitutionsController_list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/territorios/pba/partidos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Consultar el padrón de los 135 partidos de Buenos Aires
         * @description Lectura anónima e independiente del catálogo de obras. Devuelve los 135 partidos y sus UUID propios fijados en pba-partidos@1, códigos INDEC de departamento de cinco dígitos y GeoRef de municipio de seis dígitos con ceros conservados, procedencia, atribución y fecha de consulta. equivalenciasPbaMunicipio conserva pares exactos código/nombre comprobados en 95 partidos del CSV escolar auditado; los otros 40 conservan arrays vacíos. equivalenciasNacion conserva solamente el par histórico provincia/departamento de Vicente López. Las equivalencias no acreditan gestión municipal ni ubicación espacial. No incluye geometrías, conteos de obras ni frescura de fuentes de obras; limites indica disponibilidad y versión de una capa visual independiente. No admite parámetros de consulta ni requiere sesión, permisos administrativos, Origin o CSRF.
         */
        get: operations["TerritoriesController_list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/territorios/pba/partidos/limites": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Consultar la capa visual de límites de los 135 partidos PBA
         * @description Lectura anónima del derivado GeoRef simplificado conjuntamente para visualización. FeatureCollection de 135 MultiPolygon WGS84 [longitud,latitud], vinculados explícitamente a UUID del padrón. DISPLAY_ONLY: no usar para asignar obras, medir áreas, resolver límites jurídicos o verificar ubicaciones. Conserva fuente, licencia CC BY 4.0, corte abril de 2026, modificaciones y límites de la validación topológica. Presupuesto independiente de 1,5 MiB y 100.000 posiciones; no modifica las consultas o presupuestos de obras. version fija una distribución inmutable; sin ella consulta la actual con caché corta. If-None-Match concordante responde 304 sin cuerpo. Una ausencia o falla de integridad responde 503 recuperable sin afectar la consulta de obras. No requiere sesión, Origin o CSRF.
         */
        get: operations["TerritoriesController_limits"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/territorios/provincias": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Consultar las provincias disponibles para filtros públicos
         * @description Lectura anónima e independiente de obras, base de datos, cola y storage. provincias@2 registra Ciudad Autónoma de Buenos Aires (02, CIUDAD_AUTONOMA) y Buenos Aires (06, PROVINCIA). Conserva consultadoEn y las fuentes del padrón PBA ya instalado; la fuente adicional identifica el código CABA corroborado en la revisión GeoRef del 2026-10-05 y su API v2.0, sin acreditar una nueva consulta remota. Registrar una jurisdicción no atribuye obras por su fuente: el filtro requiere evidencia territorial publicada. El contrato admite futuras jurisdicciones con códigos INDEC textuales de dos dígitos. No devuelve geometrías, conteos ni frescura de las fuentes de obras. No admite parámetros de consulta ni requiere sesión, permisos administrativos, Origin o CSRF.
         */
        get: operations["TerritoriesController_provinces"];
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
                    asociacionesEspaciales: {
                        /** @enum {string} */
                        condicion: "VERIFIED";
                        evidencia: {
                            /** Format: uuid */
                            decisionId: string;
                            geometriaSha256: string;
                            limitesSha256: string;
                            limitesVersion: string;
                            /** @enum {string} */
                            metodo: "POSTGIS_INTERSECTION";
                            /** @enum {string} */
                            metodoVersion: "pba-spatial@1";
                        };
                        /** Format: uuid */
                        partidoId: string;
                        /** @enum {string} */
                        relacion: "INTERIOR" | "CROSSING";
                        ubicacionClave: string;
                    }[];
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
                        } | {
                            /** @enum {string} */
                            codigo: "EPSG:4326";
                            /** @enum {string} */
                            condicion: "SERVICE_REFERENCE";
                            /** @enum {string} */
                            fundamento: "OFFICIAL_SERVICE";
                        };
                        /** @enum {string} */
                        origenGeometria?: "ADDRESS_GEOCODE";
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
                        codigo: "pba-edificios" | "caba-actualizado" | "nacion-obras" | "vl-obras" | "bahia-obras" | "olavarria-obras" | "pergamino-obras";
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
                    rolesInstitucionales: {
                        /** @enum {string} */
                        condicion: "VERIFIED";
                        /** Format: uuid */
                        decisionId: string;
                        evidencias: ({
                            columna: string;
                            localizador: {
                                byteEndExclusive: number;
                                byteStart: number;
                                dataOrdinal: number;
                                /** @enum {string} */
                                format: "JSON";
                                pointer: string;
                            } | {
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
                        organizacion: {
                            /** Format: uuid */
                            id: string;
                            /** @enum {string} */
                            nivel: "MUNICIPAL" | "PROVINCIAL" | "NACIONAL" | "OTRO";
                            nombre: string;
                            /** Format: uuid */
                            partidoId: string | null;
                        };
                        /** @enum {string} */
                        rol: "PROMOTOR" | "CONTRATANTE" | "EJECUTOR" | "FINANCIADOR" | "CONTRATISTA";
                        vigencia: {
                            fin: ({
                                /** @enum {string} */
                                precision: "DAY";
                                valor: string & (string);
                            } | {
                                /** @enum {string} */
                                precision: "YEAR";
                                valor: string;
                            }) | null;
                            inicio: ({
                                /** @enum {string} */
                                precision: "DAY";
                                valor: string & (string);
                            } | {
                                /** @enum {string} */
                                precision: "YEAR";
                                valor: string;
                            }) | null;
                        };
                    }[];
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
        PublicInstitutionalOrganizationCatalogResponse: {
            items: {
                /** Format: uuid */
                id: string;
                /** @enum {string} */
                nivel: "MUNICIPAL" | "PROVINCIAL" | "NACIONAL" | "OTRO";
                nombre: string;
                /** Format: uuid */
                partidoId: string | null;
            }[];
        };
        PublicPartyBoundaryFeatureCollection: {
            features: {
                geometry: {
                    coordinates: (number)[][][][];
                    /** @enum {string} */
                    type: "MultiPolygon";
                };
                /** Format: uuid */
                id: string;
                properties: {
                    indecDepartamento: string;
                    nombre: string;
                    /** Format: uuid */
                    partidoId: string;
                };
                /** @enum {string} */
                type: "Feature";
            }[];
            metadata: {
                atribucion: string;
                bbox: (number)[];
                /** Format: date */
                consultadoEn: string;
                fuente: {
                    /** Format: date-time */
                    generadoEn: string;
                    licencia: {
                        nombre: string;
                        /** Format: uri */
                        url: string;
                    };
                    nombre: string;
                    sha256: string;
                    /** Format: uri */
                    url: string;
                    version: string;
                };
                transformacion: {
                    advertencia: string;
                    metodo: string;
                    precisionDecimales: number;
                    toleranciaMetros: number;
                };
                /** @enum {string} */
                uso: "DISPLAY_ONLY";
                validacion: {
                    advertencia: string;
                    /** @enum {boolean} */
                    coberturaValida: true;
                    /** @enum {number} */
                    features: 135;
                    /** @enum {number} */
                    geometriasValidas: 135;
                    posiciones: number;
                };
                /** @enum {string} */
                version: "pba-partidos-limites@1";
            };
            /** @enum {string} */
            type: "FeatureCollection";
        };
        PublicPartyCatalogResponse: {
            /** Format: date */
            consultadoEn: string;
            equivalencias: {
                /** Format: date */
                consultadoEn: string;
                licencia: {
                    nombre: string;
                    /** Format: uri */
                    url: string;
                };
                nombre: string;
                /** @enum {number} */
                partidos: 95;
                /** @enum {number} */
                registros: 324;
                sha256: string;
                /** Format: uri */
                url: string;
                /** @enum {string} */
                version: "pba-edificios-partidos@1";
            };
            fuentes: {
                licencia: {
                    nombre: string;
                    /** Format: uri */
                    url: string;
                };
                nombre: string;
                /** Format: uri */
                url: string;
            }[];
            items: {
                codigos: {
                    georefMunicipio: string;
                    indecDepartamento: string;
                };
                equivalenciasNacion: {
                    /** @enum {string} */
                    departamentoCodigo: "VICENTE_LOPEZ";
                    /** @enum {string} */
                    provinciaCodigo: "BUENOS_AIRES";
                }[];
                equivalenciasPbaMunicipio: {
                    codigo: string;
                    nombre: string;
                }[];
                nombre: string;
                /** Format: uuid */
                partidoId: string;
            }[];
            limites: {
                /** @enum {string} */
                estado: "PENDING_LICENSE_AND_VALIDATION";
                /** @enum {string|null} */
                version: null;
            } | {
                bytes: number;
                /** @enum {string} */
                estado: "VALIDATED_FOR_DISPLAY";
                posiciones: number;
                sha256: string;
                url: string;
                /** @enum {string} */
                uso: "DISPLAY_ONLY";
                /** @enum {string} */
                version: "pba-partidos-limites@1";
            };
            provincia: {
                /** @enum {string} */
                codigo: "06";
                /** @enum {string} */
                nombre: "Buenos Aires";
            };
            /** @enum {string} */
            version: "pba-partidos@1";
        };
        PublicProvinceCatalog: {
            /** Format: date */
            consultadoEn: string;
            fuentes: {
                licencia: {
                    nombre: string;
                    /** Format: uri */
                    url: string;
                };
                nombre: string;
                /** Format: uri */
                url: string;
            }[];
            items: {
                codigo: string;
                nombre: string;
                /** @enum {string} */
                tipo: "PROVINCIA" | "CIUDAD_AUTONOMA";
            }[];
            version: string;
        };
        PublicWorkDetail: {
            asociacionesEspaciales: {
                /** @enum {string} */
                condicion: "VERIFIED";
                evidencia: {
                    /** Format: uuid */
                    decisionId: string;
                    geometriaSha256: string;
                    limitesSha256: string;
                    limitesVersion: string;
                    /** @enum {string} */
                    metodo: "POSTGIS_INTERSECTION";
                    /** @enum {string} */
                    metodoVersion: "pba-spatial@1";
                };
                /** Format: uuid */
                partidoId: string;
                /** @enum {string} */
                relacion: "INTERIOR" | "CROSSING";
                ubicacionClave: string;
            }[];
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
                codigo: "pba-edificios" | "caba-actualizado" | "nacion-obras" | "vl-obras" | "bahia-obras" | "olavarria-obras" | "pergamino-obras";
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
                            format: "JSON";
                            pointer: string;
                        } | {
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
            rolesInstitucionales: {
                /** @enum {string} */
                condicion: "VERIFIED";
                /** Format: uuid */
                decisionId: string;
                evidencias: ({
                    columna: string;
                    localizador: {
                        byteEndExclusive: number;
                        byteStart: number;
                        dataOrdinal: number;
                        /** @enum {string} */
                        format: "JSON";
                        pointer: string;
                    } | {
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
                organizacion: {
                    /** Format: uuid */
                    id: string;
                    /** @enum {string} */
                    nivel: "MUNICIPAL" | "PROVINCIAL" | "NACIONAL" | "OTRO";
                    nombre: string;
                    /** Format: uuid */
                    partidoId: string | null;
                };
                /** @enum {string} */
                rol: "PROMOTOR" | "CONTRATANTE" | "EJECUTOR" | "FINANCIADOR" | "CONTRATISTA";
                vigencia: {
                    fin: ({
                        /** @enum {string} */
                        precision: "DAY";
                        valor: string & (string);
                    } | {
                        /** @enum {string} */
                        precision: "YEAR";
                        valor: string;
                    }) | null;
                    inicio: ({
                        /** @enum {string} */
                        precision: "DAY";
                        valor: string & (string);
                    } | {
                        /** @enum {string} */
                        precision: "YEAR";
                        valor: string;
                    }) | null;
                };
            }[];
            /** @enum {string} */
            schemaVersion: "obra@1" | "obra@2" | "obra@3";
            territorios: {
                codigo: string;
                /** @enum {string} */
                condicion: "REPORTED";
                /** @enum {string} */
                esquema: "pba.municipio" | "indec.departamento" | "nacion.provincia" | "nacion.departamento";
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
                } | {
                    /** @enum {string} */
                    codigo: "EPSG:4326";
                    /** @enum {string} */
                    condicion: "SERVICE_REFERENCE";
                    /** @enum {string} */
                    fundamento: "OFFICIAL_SERVICE";
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
                origenGeometria?: "ADDRESS_GEOCODE";
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
                } | {
                    /** @enum {string} */
                    codigo: "EPSG:4326";
                    /** @enum {string} */
                    condicion: "SERVICE_REFERENCE";
                    /** @enum {string} */
                    fundamento: "OFFICIAL_SERVICE";
                }) | null;
                direccionReportada?: {
                    calle: string | null;
                    numero: string | null;
                };
                /** @enum {string|null} */
                geometria: null;
                /** @enum {string} */
                origenGeometria?: "ADDRESS_GEOCODE";
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
            asociacionesEspaciales: {
                /** @enum {string} */
                condicion: "VERIFIED";
                evidencia: {
                    /** Format: uuid */
                    decisionId: string;
                    geometriaSha256: string;
                    limitesSha256: string;
                    limitesVersion: string;
                    /** @enum {string} */
                    metodo: "POSTGIS_INTERSECTION";
                    /** @enum {string} */
                    metodoVersion: "pba-spatial@1";
                };
                /** Format: uuid */
                partidoId: string;
                /** @enum {string} */
                relacion: "INTERIOR" | "CROSSING";
                ubicacionClave: string;
            }[];
            clasificaciones: {
                codigo: string;
                esquema: string;
                etiqueta: string;
            }[];
            /** @enum {string|null} */
            estado: "COMPLETED" | "IN_PROGRESS" | "OTHER_REPORTED" | null;
            fuentes: {
                /** @enum {string} */
                codigo: "pba-edificios" | "caba-actualizado" | "nacion-obras" | "vl-obras" | "bahia-obras" | "olavarria-obras" | "pergamino-obras";
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
            rolesInstitucionales: {
                /** @enum {string} */
                condicion: "VERIFIED";
                /** Format: uuid */
                decisionId: string;
                evidencias: ({
                    columna: string;
                    localizador: {
                        byteEndExclusive: number;
                        byteStart: number;
                        dataOrdinal: number;
                        /** @enum {string} */
                        format: "JSON";
                        pointer: string;
                    } | {
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
                organizacion: {
                    /** Format: uuid */
                    id: string;
                    /** @enum {string} */
                    nivel: "MUNICIPAL" | "PROVINCIAL" | "NACIONAL" | "OTRO";
                    nombre: string;
                    /** Format: uuid */
                    partidoId: string | null;
                };
                /** @enum {string} */
                rol: "PROMOTOR" | "CONTRATANTE" | "EJECUTOR" | "FINANCIADOR" | "CONTRATISTA";
                vigencia: {
                    fin: ({
                        /** @enum {string} */
                        precision: "DAY";
                        valor: string & (string);
                    } | {
                        /** @enum {string} */
                        precision: "YEAR";
                        valor: string;
                    }) | null;
                    inicio: ({
                        /** @enum {string} */
                        precision: "DAY";
                        valor: string & (string);
                    } | {
                        /** @enum {string} */
                        precision: "YEAR";
                        valor: string;
                    }) | null;
                };
            }[];
            territorios: {
                codigo: string;
                /** @enum {string} */
                condicion: "REPORTED";
                /** @enum {string} */
                esquema: "pba.municipio" | "indec.departamento" | "nacion.provincia" | "nacion.departamento";
                nombre: string;
            }[];
            tieneGeometria: boolean;
        };
        RateLimitedError: {
            error: {
                /** @enum {string} */
                code: "RATE_LIMITED";
                message: string;
                /** Format: uuid */
                requestId: string | null;
            };
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
                fuente?: "pba-edificios" | "caba-actualizado" | "nacion-obras" | "vl-obras" | "bahia-obras" | "olavarria-obras" | "pergamino-obras";
                /** @description Partido de una institución municipal con rol VERIFIED PROMOTOR, CONTRATANTE, EJECUTOR o FINANCIADOR. No incluye CONTRATISTA ni deduce responsabilidades de la fuente. */
                gestionMunicipalId?: string;
                limit?: number;
                /** @description Texto con ceros conservados, acompañado por territorioEsquema=pba.municipio. */
                municipioCodigo?: string;
                /** @description Identidad del catálogo institucional público; debe cumplir los demás filtros institucionales en la misma relación de esta revisión. */
                organizacionId?: string;
                /** @description UUID del padrón GET /api/v1/territorios/pba/partidos. Selecciona el territorio canónico indec.departamento REPORTED de la revisión publicada, una equivalencia pba.municipio REPORTED documentada por su par exacto código/nombre en 95 partidos del CSV escolar auditado, o el par nacional histórico REPORTED nacion.provincia=BUENOS_AIRES y nacion.departamento=VICENTE_LOPEZ únicamente para Vicente López. Los otros 40 partidos no reciben equivalencias PBA legacy inferidas y no hay equivalencias nacionales históricas para otros partidos. No acredita gestión municipal ni pertenencia espacial; no infiere por fuente o coordenadas. Incompatible con partidos, territorioEsquema y municipioCodigo. El cursor incorpora la versión del padrón cuando se usa este filtro. */
                partidoId?: string;
                /** @description UUID repetible del padrón PBA; máximo 135 valores brutos. Se convierte a minúsculas, deduplica y ordena. OR entre partidos, AND con provinciaCodigo y otros filtros; sin partidos no restringe partidos. Cada identidad conserva la semántica REPORTED de partidoId: territorio canónico indec.departamento, uno de los 95 pares pba.municipio exactos auditados, o únicamente el par nacional histórico de Vicente López. No usa relaciones VERIFIED ni infiere equivalencias nuevas. Incompatible con partidoId, territorioEsquema y municipioCodigo. El cursor incorpora el conjunto canónico y la versión del padrón. */
                partidos?: string[];
                /** @description Partido con asociación espacial VERIFIED en la revisión publicada; usa sólo geometrías aceptadas y límites originales auditados. Independiente de partidoId REPORTED. */
                partidoVerificadoId?: string;
                /** @description Inicio civil YYYY-MM-DD, inclusivo, de solapamiento con vigencia institucional. Requiere periodoHasta. YEAR se expande sólo para búsqueda; una única fecha conocida usa su propio intervalo y ambas desconocidas se excluyen. No consulta fechas de obra, períodos educativos, publicación ni actualización de fuente. */
                periodoDesde?: string & (string);
                /** @description Fin civil YYYY-MM-DD inclusivo y no anterior a periodoDesde; todos los filtros institucionales coinciden en el mismo rol. */
                periodoHasta?: string & (string);
                /** @description Código INDEC provincial repetible del catálogo GET /api/v1/territorios/provincias: 02 (CABA) y 06 (Buenos Aires). Admite un valor o parámetros repetidos, máximo 24 valores brutos; deduplica y ordena. Sin este filtro conserva el alcance global, incluidas obras con territorio vacío. OR entre provincias y AND con los demás filtros. PBA exige nacion.provincia=BUENOS_AIRES REPORTED, partido canónico o par legacy exacto REPORTED del padrón, o asociación espacial VERIFIED publicada. CABA exige nacion.provincia=CABA REPORTED; no existe caba.comuna soportado. Para cada provincia veta cualquier código provincial REPORTED distinto o texto nacional crudo no compatible tras NFD, acentos, espacios y caso. Los únicos aliases crudos CABA son CABA, CIUDAD AUTONOMA DE BUENOS AIRES y CAPITAL FEDERAL; PBA admite BUENOS AIRES. Para CABA también veta partido PBA REPORTED reconocido o asociación VERIFIED PBA. Texto provincial desconocido, vacío, múltiple o contradictorio veta. No atribuye por fuente, editor, institución, candidata, coordenadas, corroboración CRS ni bbox. El cursor incluye catálogos provincial/de partidos y versión de relaciones. */
                provinciaCodigo?: string[];
                /** @description Rol verificado; organización, gestión municipal y período se aplican a la misma fila. */
                rolInstitucional?: "PROMOTOR" | "CONTRATANTE" | "EJECUTOR" | "FINANCIADOR" | "CONTRATISTA";
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
            /** @description Filtros, códigos provinciales o UUID fuera de catálogos, listas vacías o excesivas, combinación territorial, límite o cursor no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicApiError"];
                };
            };
            /** @description RATE_LIMITED: cuota compartida por IP para lecturas del mapa, catálogo y fichas públicas, o capacidad de contadores de esta instancia agotada. Por defecto 240 solicitudes en 60 segundos, configurable por entorno. Retry-After indica los segundos restantes antes de reintentar. Cada proceso mantiene sus propios contadores; varias instancias requieren coordinación en la infraestructura. X-Forwarded-For solo se considera cuando el proxy inmediato está configurado como confiable; la cadena se recorre desde ese proxy hasta el primer salto no confiable. */
            429: {
                headers: {
                    /** @description El rechazo por cuota no se almacena en cachés compartidas. */
                    "Cache-Control"?: "no-store";
                    /** @description Plazo mínimo para reintentar, en segundos enteros; siempre al menos 1. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": {
                     *         "code": "RATE_LIMITED",
                     *         "message": "Demasiadas solicitudes. Reintentá después del plazo indicado en Retry-After.",
                     *         "requestId": "10000000-0000-4000-8000-000000000001"
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["RateLimitedError"];
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
            /** @description RATE_LIMITED: cuota compartida por IP para lecturas del mapa, catálogo y fichas públicas, o capacidad de contadores de esta instancia agotada. Por defecto 240 solicitudes en 60 segundos, configurable por entorno. Retry-After indica los segundos restantes antes de reintentar. Cada proceso mantiene sus propios contadores; varias instancias requieren coordinación en la infraestructura. X-Forwarded-For solo se considera cuando el proxy inmediato está configurado como confiable; la cadena se recorre desde ese proxy hasta el primer salto no confiable. */
            429: {
                headers: {
                    /** @description El rechazo por cuota no se almacena en cachés compartidas. */
                    "Cache-Control"?: "no-store";
                    /** @description Plazo mínimo para reintentar, en segundos enteros; siempre al menos 1. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": {
                     *         "code": "RATE_LIMITED",
                     *         "message": "Demasiadas solicitudes. Reintentá después del plazo indicado en Retry-After.",
                     *         "requestId": "10000000-0000-4000-8000-000000000001"
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["RateLimitedError"];
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
                fuente?: "pba-edificios" | "caba-actualizado" | "nacion-obras" | "vl-obras" | "bahia-obras" | "olavarria-obras" | "pergamino-obras";
                /** @description Partido de una institución municipal con rol VERIFIED PROMOTOR, CONTRATANTE, EJECUTOR o FINANCIADOR. No incluye CONTRATISTA ni deduce responsabilidades de la fuente. */
                gestionMunicipalId?: string;
                limit?: number;
                /** @description Texto con ceros conservados, acompañado por territorioEsquema=pba.municipio. */
                municipioCodigo?: string;
                /** @description Identidad del catálogo institucional público; debe cumplir los demás filtros institucionales en la misma relación de esta revisión. */
                organizacionId?: string;
                /** @description UUID del padrón GET /api/v1/territorios/pba/partidos. Selecciona el territorio canónico indec.departamento REPORTED de la revisión publicada, una equivalencia pba.municipio REPORTED documentada por su par exacto código/nombre en 95 partidos del CSV escolar auditado, o el par nacional histórico REPORTED nacion.provincia=BUENOS_AIRES y nacion.departamento=VICENTE_LOPEZ únicamente para Vicente López. Los otros 40 partidos no reciben equivalencias PBA legacy inferidas y no hay equivalencias nacionales históricas para otros partidos. No acredita gestión municipal ni pertenencia espacial; no infiere por fuente o coordenadas. Incompatible con partidos, territorioEsquema y municipioCodigo. El cursor incorpora la versión del padrón cuando se usa este filtro. */
                partidoId?: string;
                /** @description UUID repetible del padrón PBA; máximo 135 valores brutos. Se convierte a minúsculas, deduplica y ordena. OR entre partidos, AND con provinciaCodigo y otros filtros; sin partidos no restringe partidos. Cada identidad conserva la semántica REPORTED de partidoId: territorio canónico indec.departamento, uno de los 95 pares pba.municipio exactos auditados, o únicamente el par nacional histórico de Vicente López. No usa relaciones VERIFIED ni infiere equivalencias nuevas. Incompatible con partidoId, territorioEsquema y municipioCodigo. El cursor incorpora el conjunto canónico y la versión del padrón. */
                partidos?: string[];
                /** @description Partido con asociación espacial VERIFIED en la revisión publicada; usa sólo geometrías aceptadas y límites originales auditados. Independiente de partidoId REPORTED. */
                partidoVerificadoId?: string;
                /** @description Inicio civil YYYY-MM-DD, inclusivo, de solapamiento con vigencia institucional. Requiere periodoHasta. YEAR se expande sólo para búsqueda; una única fecha conocida usa su propio intervalo y ambas desconocidas se excluyen. No consulta fechas de obra, períodos educativos, publicación ni actualización de fuente. */
                periodoDesde?: string & (string);
                /** @description Fin civil YYYY-MM-DD inclusivo y no anterior a periodoDesde; todos los filtros institucionales coinciden en el mismo rol. */
                periodoHasta?: string & (string);
                /** @description Código INDEC provincial repetible del catálogo GET /api/v1/territorios/provincias: 02 (CABA) y 06 (Buenos Aires). Admite un valor o parámetros repetidos, máximo 24 valores brutos; deduplica y ordena. Sin este filtro conserva el alcance global, incluidas obras con territorio vacío. OR entre provincias y AND con los demás filtros. PBA exige nacion.provincia=BUENOS_AIRES REPORTED, partido canónico o par legacy exacto REPORTED del padrón, o asociación espacial VERIFIED publicada. CABA exige nacion.provincia=CABA REPORTED; no existe caba.comuna soportado. Para cada provincia veta cualquier código provincial REPORTED distinto o texto nacional crudo no compatible tras NFD, acentos, espacios y caso. Los únicos aliases crudos CABA son CABA, CIUDAD AUTONOMA DE BUENOS AIRES y CAPITAL FEDERAL; PBA admite BUENOS AIRES. Para CABA también veta partido PBA REPORTED reconocido o asociación VERIFIED PBA. Texto provincial desconocido, vacío, múltiple o contradictorio veta. No atribuye por fuente, editor, institución, candidata, coordenadas, corroboración CRS ni bbox. El cursor incluye catálogos provincial/de partidos y versión de relaciones. */
                provinciaCodigo?: string[];
                /** @description Rol verificado; organización, gestión municipal y período se aplican a la misma fila. */
                rolInstitucional?: "PROMOTOR" | "CONTRATANTE" | "EJECUTOR" | "FINANCIADOR" | "CONTRATISTA";
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
             *     Filtros, códigos provinciales o UUID fuera de catálogos, listas vacías o excesivas, combinación territorial, límite o cursor no válidos.
             */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicApiError"];
                };
            };
            /** @description RATE_LIMITED: cuota compartida por IP para lecturas del mapa, catálogo y fichas públicas, o capacidad de contadores de esta instancia agotada. Por defecto 240 solicitudes en 60 segundos, configurable por entorno. Retry-After indica los segundos restantes antes de reintentar. Cada proceso mantiene sus propios contadores; varias instancias requieren coordinación en la infraestructura. X-Forwarded-For solo se considera cuando el proxy inmediato está configurado como confiable; la cadena se recorre desde ese proxy hasta el primer salto no confiable. */
            429: {
                headers: {
                    /** @description El rechazo por cuota no se almacena en cachés compartidas. */
                    "Cache-Control"?: "no-store";
                    /** @description Plazo mínimo para reintentar, en segundos enteros; siempre al menos 1. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": {
                     *         "code": "RATE_LIMITED",
                     *         "message": "Demasiadas solicitudes. Reintentá después del plazo indicado en Retry-After.",
                     *         "requestId": "10000000-0000-4000-8000-000000000001"
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["RateLimitedError"];
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
    PublicInstitutionsController_list: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Catálogo institucional completo publicado. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicInstitutionalOrganizationCatalogResponse"];
                };
            };
            /** @description La consulta no admite parámetros. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicApiError"];
                };
            };
            /** @description RATE_LIMITED: cuota compartida por IP para lecturas del mapa, catálogo y fichas públicas, o capacidad de contadores de esta instancia agotada. Por defecto 240 solicitudes en 60 segundos, configurable por entorno. Retry-After indica los segundos restantes antes de reintentar. Cada proceso mantiene sus propios contadores; varias instancias requieren coordinación en la infraestructura. X-Forwarded-For solo se considera cuando el proxy inmediato está configurado como confiable; la cadena se recorre desde ese proxy hasta el primer salto no confiable. */
            429: {
                headers: {
                    /** @description El rechazo por cuota no se almacena en cachés compartidas. */
                    "Cache-Control"?: "no-store";
                    /** @description Plazo mínimo para reintentar, en segundos enteros; siempre al menos 1. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": {
                     *         "code": "RATE_LIMITED",
                     *         "message": "Demasiadas solicitudes. Reintentá después del plazo indicado en Retry-After.",
                     *         "requestId": "10000000-0000-4000-8000-000000000001"
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["RateLimitedError"];
                };
            };
            /** @description INSTITUTION_CATALOG_UNAVAILABLE: catálogo excede presupuesto; no se entregan identidades parciales. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicApiError"];
                };
            };
        };
    };
    TerritoriesController_list: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Padrón completo de 135 partidos sin paginación; versión nominal independiente de catalogoVersion de obras. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicPartyCatalogResponse"];
                };
            };
            /** @description Parámetros de consulta no admitidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicApiError"];
                };
            };
            /** @description RATE_LIMITED: cuota compartida por IP para lecturas del mapa, catálogo y fichas públicas, o capacidad de contadores de esta instancia agotada. Por defecto 240 solicitudes en 60 segundos, configurable por entorno. Retry-After indica los segundos restantes antes de reintentar. Cada proceso mantiene sus propios contadores; varias instancias requieren coordinación en la infraestructura. X-Forwarded-For solo se considera cuando el proxy inmediato está configurado como confiable; la cadena se recorre desde ese proxy hasta el primer salto no confiable. */
            429: {
                headers: {
                    /** @description El rechazo por cuota no se almacena en cachés compartidas. */
                    "Cache-Control"?: "no-store";
                    /** @description Plazo mínimo para reintentar, en segundos enteros; siempre al menos 1. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": {
                     *         "code": "RATE_LIMITED",
                     *         "message": "Demasiadas solicitudes. Reintentá después del plazo indicado en Retry-After.",
                     *         "requestId": "10000000-0000-4000-8000-000000000001"
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["RateLimitedError"];
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
    TerritoriesController_limits: {
        parameters: {
            query?: {
                /** @description Versión exacta publicada en limites.version del padrón. Una versión no instalada responde 404; el nombre nunca controla una ruta de archivo. */
                version?: string;
            };
            header?: {
                /** @description ETag de una respuesta anterior; permite revalidación y 304 sin cuerpo. */
                "If-None-Match"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description FeatureCollection completa sin paginación, con bytes exactos verificados frente al manifiesto. */
            200: {
                headers: {
                    /** @description public,max-age=31536000,immutable con versión explícita; public,max-age=3600,must-revalidate para la distribución actual. */
                    "Cache-Control"?: string;
                    /** @description SHA-256 de los bytes exactos de la distribución. */
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicPartyBoundaryFeatureCollection"];
                };
            };
            /** @description La distribución coincide con If-None-Match; respuesta sin cuerpo. */
            304: {
                headers: {
                    "Cache-Control"?: string;
                    ETag?: string;
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description BOUNDARY_VERSION_NOT_FOUND: versión no instalada. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicApiError"];
                };
            };
            /** @description Parámetros de consulta no admitidos o versión mal formada. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicApiError"];
                };
            };
            /** @description RATE_LIMITED: cuota compartida por IP para lecturas del mapa, catálogo y fichas públicas, o capacidad de contadores de esta instancia agotada. Por defecto 240 solicitudes en 60 segundos, configurable por entorno. Retry-After indica los segundos restantes antes de reintentar. Cada proceso mantiene sus propios contadores; varias instancias requieren coordinación en la infraestructura. X-Forwarded-For solo se considera cuando el proxy inmediato está configurado como confiable; la cadena se recorre desde ese proxy hasta el primer salto no confiable. */
            429: {
                headers: {
                    /** @description El rechazo por cuota no se almacena en cachés compartidas. */
                    "Cache-Control"?: "no-store";
                    /** @description Plazo mínimo para reintentar, en segundos enteros; siempre al menos 1. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": {
                     *         "code": "RATE_LIMITED",
                     *         "message": "Demasiadas solicitudes. Reintentá después del plazo indicado en Retry-After.",
                     *         "requestId": "10000000-0000-4000-8000-000000000001"
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["RateLimitedError"];
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
            /** @description BOUNDARIES_UNAVAILABLE: asset ausente o integridad/presupuesto no válido; reintentar sin perder la consulta de obras. */
            503: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicApiError"];
                };
            };
        };
    };
    TerritoriesController_provinces: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Catálogo nominal completo sin paginación y con versión independiente de catalogoVersion de obras. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicProvinceCatalog"];
                };
            };
            /** @description Parámetros de consulta no admitidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicApiError"];
                };
            };
            /** @description RATE_LIMITED: cuota compartida por IP para lecturas del mapa, catálogo y fichas públicas, o capacidad de contadores de esta instancia agotada. Por defecto 240 solicitudes en 60 segundos, configurable por entorno. Retry-After indica los segundos restantes antes de reintentar. Cada proceso mantiene sus propios contadores; varias instancias requieren coordinación en la infraestructura. X-Forwarded-For solo se considera cuando el proxy inmediato está configurado como confiable; la cadena se recorre desde ese proxy hasta el primer salto no confiable. */
            429: {
                headers: {
                    /** @description El rechazo por cuota no se almacena en cachés compartidas. */
                    "Cache-Control"?: "no-store";
                    /** @description Plazo mínimo para reintentar, en segundos enteros; siempre al menos 1. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": {
                     *         "code": "RATE_LIMITED",
                     *         "message": "Demasiadas solicitudes. Reintentá después del plazo indicado en Retry-After.",
                     *         "requestId": "10000000-0000-4000-8000-000000000001"
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["RateLimitedError"];
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
