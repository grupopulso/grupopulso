"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  ArrowLeft,
  BadgePercent,
  CreditCard,
  Plus,
  Save,
  UserPlus,
  UserRound,
  X,
} from "lucide-react";

import {
  createClient,
} from "@/app/lib/supabase/client";

import {
  createContract,
} from "@/app/(dashboard)/contratos/novo/actions";

import {
  linkRenewalContracts,
  type RenewalPrefill,
} from "@/app/(dashboard)/contratos/[id]/actions";

import {
  buildDueDates,
} from "@/app/lib/date-utils";

import ClientCombobox from "@/app/components/client-combobox";

/*
 * =====================================================
 * TIPOS
 * =====================================================
 */

type Client = {
  id: string;

  name: string;

  client_companies:
    | {
        company_id: string;
        status: string;
      }[]
    | null;
};

type Company = {
  id: string;
  name: string;
};

type Product = {
  id: string;

  company_id: string;

  name: string;

  default_price:
    | number
    | null;

  billing_frequency:
    | string
    | null;

  commission_percentage:
    | number
    | string
    | null;
};

type PaymentMethod = {
  id: string;
  name: string;
  code: string;
  use_for: string;
};

type Tv = {
  id: string;
  name: string;

  location:
    | string
    | null;
};

type DeliveryRoute = {
  id: string;
  name: string;
  company_id: string;
  region: string | null;
};

type CurrentUser = {
  id: string;

  name: string;

  email:
    | string
    | null;
};

type SellerSetting = {
  user_id: string;

  company_id: string;

  commission_percentage:
    | number
    | string;
};

type BillingFrequency =
  | "one_time"
  | "monthly"
  | "quarterly"
  | "semiannual"
  | "annual"
  | "custom";

type ContractFormProps = {
  initialClientId?: string;

  /*
   * Empresas às quais o usuário pode vincular um contrato.
   * null = admin (todas). A Server Action createContract
   * também valida isso (requireCompanyAccess).
   */
  allowedCompanyIds?: string[] | null;

  /*
   * Quando presente, o formulário funciona em modo
   * "renovação": nasce pré-preenchido com os dados do
   * contrato de origem e, ao salvar, registra o vínculo
   * entre os dois contratos.
   */
  renewal?: RenewalPrefill | null;
};

/*
 * =====================================================
 * CONSTANTES
 * =====================================================
 */

const POTTENCIALIZA_COMPANY_ID =
  "9d08d74c-c5fe-48c9-b0c5-382cea273d99";

/*
 * =====================================================
 * COMPONENTE
 * =====================================================
 */

export default function ContractForm({
  initialClientId = "",
  allowedCompanyIds = null,
  renewal = null,
}: ContractFormProps) {
  const router =
    useRouter();

  const isRenewal =
    Boolean(renewal);

  const [
    renewalLocked,
    setRenewalLocked,
  ] =
    useState(
      Boolean(renewal)
    );

  const [
    supabase,
  ] =
    useState(
      () =>
        createClient()
    );

  /*
   * =====================================================
   * DADOS
   * =====================================================
   */

  const [
    clients,
    setClients,
  ] =
    useState<
      Client[]
    >([]);

  const [
    companies,
    setCompanies,
  ] =
    useState<
      Company[]
    >([]);

  const [
    products,
    setProducts,
  ] =
    useState<
      Product[]
    >([]);

  const [
    paymentMethods,
    setPaymentMethods,
  ] =
    useState<
      PaymentMethod[]
    >([]);

  const [
    tvs,
    setTvs,
  ] =
    useState<
      Tv[]
    >([]);

  const [
    routes,
    setRoutes,
  ] =
    useState<
      DeliveryRoute[]
    >([]);

  /*
   * =====================================================
   * USUÁRIO
   * =====================================================
   */

  const [
    currentUser,
    setCurrentUser,
  ] =
    useState<
      CurrentUser | null
    >(null);

  const [
    sellerSettings,
    setSellerSettings,
  ] =
    useState<
      SellerSetting[]
    >([]);

  const [
    userLoading,
    setUserLoading,
  ] =
    useState(
      true
    );

  /*
   * =====================================================
   * FORM
   * =====================================================
   */

  const [
    selectedTvIds,
    setSelectedTvIds,
  ] =
    useState<
      string[]
    >([]);

  const [
    clientId,
    setClientId,
  ] =
    useState(
      renewal?.clientId ?? ""
    );

  const [
    companyId,
    setCompanyId,
  ] =
    useState(
      renewal?.companyId ?? ""
    );

  const [
    productId,
    setProductId,
  ] =
    useState(
      renewal?.productId ?? ""
    );

  const [
    title,
    setTitle,
  ] =
    useState(
      renewal?.title ?? ""
    );

  const [
    startDate,
    setStartDate,
  ] =
    useState(
      renewal?.startDate ||
        getToday()
    );

  const [
    endDate,
    setEndDate,
  ] =
    useState(
      renewal?.endDate ?? ""
    );

  const [
    firstDueDate,
    setFirstDueDate,
  ] =
    useState(
      renewal?.firstDueDate ||
        getToday()
    );

  const [
    value,
    setValue,
  ] =
    useState(
      renewal
        ? formatMoneyInput(
            renewal.value
          )
        : ""
    );

  const [
    billingFrequency,
    setBillingFrequency,
  ] =
    useState<
      BillingFrequency
    >(
      (renewal?.billingFrequency as BillingFrequency) ??
        "monthly"
    );

  const [
    paymentMethodId,
    setPaymentMethodId,
  ] =
    useState(
      renewal?.paymentMethodId ?? ""
    );

  const [
    installments,
    setInstallments,
  ] =
    useState(
      renewal?.installments ?? 1
    );

  const [
    intervalDays,
    setIntervalDays,
  ] =
    useState(
      30
    );

  const [
    deliveryRouteId,
    setDeliveryRouteId,
  ] =
    useState("");

  const [
    installmentValues,
    setInstallmentValues,
  ] =
    useState<
      string[]
    >([
      "",
    ]);

  const [
    installmentDues,
    setInstallmentDues,
  ] =
    useState<
      string[]
    >([
      "",
    ]);

  const [
    autoRenew,
    setAutoRenew,
  ] =
    useState(
      renewal?.autoRenew ?? false
    );

  const [
    courtesy,
    setCourtesy,
  ] =
    useState(false);

  const [
    notes,
    setNotes,
  ] =
    useState(
      renewal?.notes ?? ""
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      false
    );

  const [
    error,
    setError,
  ] =
    useState("");

  /*
   * =====================================================
   * CADASTRO RÁPIDO DE CLIENTE
   * =====================================================
   */

  const [
    showNewClient,
    setShowNewClient,
  ] =
    useState(
      false
    );

  const [
    newClientType,
    setNewClientType,
  ] =
    useState<
      "individual" |
      "company"
    >(
      "company"
    );

  const [
    newClientName,
    setNewClientName,
  ] =
    useState("");

  const [
    newClientTradeName,
    setNewClientTradeName,
  ] =
    useState("");

  const [
    newClientDocument,
    setNewClientDocument,
  ] =
    useState("");

  const [
    newClientEmail,
    setNewClientEmail,
  ] =
    useState("");

  const [
    newClientPhone,
    setNewClientPhone,
  ] =
    useState("");

  const [
    newClientWhatsapp,
    setNewClientWhatsapp,
  ] =
    useState("");

  const [
    creatingClient,
    setCreatingClient,
  ] =
    useState(
      false
    );

  /*
   * =====================================================
   * CARREGAMENTO
   * =====================================================
   */

  useEffect(
    () => {
      async function loadData() {
        setUserLoading(
          true
        );

        const {
          data:
            userResult,
          error:
            authError,
        } =
          await supabase.auth
            .getUser();

        if (
          authError ||
          !userResult.user
        ) {
          console.error(
            "Erro ao carregar usuário autenticado:",
            authError
          );

          setError(
            "Não foi possível identificar o usuário autenticado."
          );

          setUserLoading(
            false
          );

          return;
        }

        const authenticatedUser =
          userResult.user;

        const {
          data:
            profile,
          error:
            profileError,
        } =
          await supabase
            .from(
              "user_profiles"
            )
            .select(`
              id,
              name,
              active
            `)
            .eq(
              "id",
              authenticatedUser.id
            )
            .maybeSingle();

        if (
          profileError
        ) {
          console.error(
            "Erro ao carregar perfil:",
            profileError
          );
        }

        setCurrentUser({
          id:
            authenticatedUser.id,

          name:
            profile
              ?.name ??
            authenticatedUser
              .email ??
            "Usuário",

          email:
            authenticatedUser
              .email ??
            null,
        });

        const [
          clientsResult,
          companiesResult,
          productsResult,
          paymentMethodsResult,
          tvsResult,
          routesResult,
          sellerSettingsResult,
        ] =
          await Promise.all([
            supabase
              .from(
                "clients"
              )
              .select(`
                id,
                name,

                client_companies (
                  company_id,
                  status
                )
              `)
              .eq(
                "active",
                true
              )
              .order(
                "name"
              ),

            supabase
              .from(
                "companies"
              )
              .select(`
                id,
                name
              `)
              .eq(
                "active",
                true
              )
              .order(
                "name"
              ),

            supabase
              .from(
                "products"
              )
              .select(`
                id,
                company_id,
                name,
                default_price,
                billing_frequency,
                commission_percentage
              `)
              .eq(
                "active",
                true
              )
              .order(
                "name"
              ),

            supabase
              .from(
                "payment_methods"
              )
              .select(`
                id,
                name,
                code,
                use_for
              `)
              .eq(
                "active",
                true
              )
              .in(
                "use_for",
                [
                  "income",
                  "both",
                ]
              )
              .order(
                "name"
              ),

            supabase
              .from(
                "pottencializa_tvs"
              )
              .select(`
                id,
                name,
                location
              `)
              .eq(
                "company_id",
                POTTENCIALIZA_COMPANY_ID
              )
              .eq(
                "active",
                true
              )
              .order(
                "name"
              ),

            supabase
              .from(
                "delivery_routes"
              )
              .select(`
                id,
                name,
                company_id,
                region
              `)
              .eq(
                "active",
                true
              )
              .order(
                "name"
              ),

            supabase
              .from(
                "seller_settings"
              )
              .select(`
                user_id,
                company_id,
                commission_percentage
              `)
              .eq(
                "user_id",
                authenticatedUser.id
              )
              .eq(
                "active",
                true
              ),
          ]);

        if (
          clientsResult.error
        ) {
          console.error(
            "Erro ao carregar clientes:",
            clientsResult.error
          );
        }

        if (
          companiesResult.error
        ) {
          console.error(
            "Erro ao carregar empresas:",
            companiesResult.error
          );
        }

        if (
          productsResult.error
        ) {
          console.error(
            "Erro ao carregar produtos:",
            productsResult.error
          );
        }

        if (
          paymentMethodsResult.error
        ) {
          console.error(
            "Erro ao carregar formas de pagamento:",
            paymentMethodsResult.error
          );
        }

        if (
          tvsResult.error
        ) {
          console.error(
            "Erro ao carregar TVs:",
            tvsResult.error
          );
        }

        if (
          routesResult.error
        ) {
          console.error(
            "Erro ao carregar rotas de entrega:",
            routesResult.error
          );
        }

        if (
          sellerSettingsResult.error
        ) {
          console.error(
            "Erro ao carregar comissão:",
            sellerSettingsResult.error
          );
        }

        const loadedClients =
          (
            clientsResult.data ??
            []
          ) as Client[];

        setClients(
          loadedClients
        );

        setCompanies(
          (
            companiesResult.data ??
            []
          ).filter(
            (company) =>
              !allowedCompanyIds ||
              allowedCompanyIds.includes(
                company.id
              )
          )
        );

        setProducts(
          (
            productsResult.data ??
            []
          ) as Product[]
        );

        setPaymentMethods(
          paymentMethodsResult.data ??
            []
        );

        setTvs(
          (
            tvsResult.data ??
            []
          ) as Tv[]
        );

        setRoutes(
          (
            routesResult.data ??
            []
          ) as DeliveryRoute[]
        );

        setSellerSettings(
          (
            sellerSettingsResult.data ??
            []
          ) as SellerSetting[]
        );

        /*
         * CLIENTE INICIAL
         */

        if (
          initialClientId
        ) {
          const initialClient =
            loadedClients.find(
              (
                client
              ) =>
                client.id ===
                initialClientId
            );

          if (
            initialClient
          ) {
            setClientId(
              initialClientId
            );

            const relation =
              initialClient
                .client_companies
                ?.find(
                  (
                    item
                  ) =>
                    item.status ===
                    "active"
                );

            if (
              relation
            ) {
              setCompanyId(
                relation.company_id
              );
            }
          }
        }

        setUserLoading(
          false
        );
      }

      loadData();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [
      supabase,
      initialClientId,
    ]
  );

  /*
   * =====================================================
   * PRODUTOS DISPONÍVEIS
   * =====================================================
   */

  const availableProducts =
    useMemo(
      () =>
        products.filter(
          (
            product
          ) =>
            product.company_id ===
            companyId
        ),
      [
        products,
        companyId,
      ]
    );

  const availableRoutes =
    useMemo(
      () =>
        routes.filter(
          (route) =>
            route.company_id ===
            companyId
        ),
      [
        routes,
        companyId,
      ]
    );

  useEffect(
    () => {
      if (
        deliveryRouteId &&
        !availableRoutes.some(
          (route) =>
            route.id ===
            deliveryRouteId
        )
      ) {
        setDeliveryRouteId("");
      }
    },
    [
      availableRoutes,
      deliveryRouteId,
    ]
  );

  /*
   * =====================================================
   * COMISSÃO PADRÃO
   * =====================================================
   */

  const currentSellerSetting =
    useMemo(
      () =>
        sellerSettings.find(
          (
            setting
          ) =>
            setting.company_id ===
            companyId
        ) ??
        null,
      [
        sellerSettings,
        companyId,
      ]
    );

  const sellerCommissionPercentage =
    currentSellerSetting
      ? Number(
          currentSellerSetting
            .commission_percentage ??
            0
        )
      : 0;

  /*
   * =====================================================
   * PRODUTO SELECIONADO
   * =====================================================
   */

  const selectedProduct =
    useMemo(
      () =>
        products.find(
          (
            product
          ) =>
            product.id ===
              productId &&
            product.company_id ===
              companyId
        ) ??
        null,
      [
        products,
        productId,
        companyId,
      ]
    );

  /*
   * =====================================================
   * COMISSÃO EFETIVA
   * =====================================================
   */

  const hasProductCommission =
    selectedProduct !==
      null &&
    selectedProduct
      .commission_percentage !==
      null;

  const commissionPercentage =
    hasProductCommission
      ? Number(
          selectedProduct
            ?.commission_percentage ??
            0
        )
      : sellerCommissionPercentage;

  const commissionSource:
    | "product"
    | "seller" =
    hasProductCommission
      ? "product"
      : "seller";

  /*
   * =====================================================
   * PRODUTO AUTOMÁTICO
   * =====================================================
   */

  useEffect(
    () => {
      if (
        products.length > 0 &&
        productId &&
        !availableProducts.some(
          (
            product
          ) =>
            product.id ===
            productId
        )
      ) {
        setProductId(
          ""
        );
      }
    },
    [
      products,
      availableProducts,
      productId,
    ]
  );

  useEffect(
    () => {
      if (
        !renewalLocked &&
        availableProducts.length ===
          1 &&
        !productId
      ) {
        const product =
          availableProducts[
            0
          ];

        setProductId(
          product.id
        );

        setTitle(
          product.name
        );

        if (
          product.default_price !==
          null
        ) {
          setValue(
            formatMoneyInput(
              Number(
                product.default_price
              )
            )
          );
        }

        if (
          product.billing_frequency
        ) {
          setBillingFrequency(
            product.billing_frequency as BillingFrequency
          );
        }
      }
    },
    [
      availableProducts,
      productId,
      renewalLocked,
    ]
  );

  /*
   * =====================================================
   * CLIENTE
   * =====================================================
   */

  function handleClientChange(
    id:
      string
  ) {
    setRenewalLocked(
      false
    );

    setClientId(
      id
    );

    setProductId(
      ""
    );

    setCompanyId(
      ""
    );

    setSelectedTvIds(
      []
    );

    if (
      !id
    ) {
      return;
    }

    const client =
      clients.find(
        (
          item
        ) =>
          item.id ===
          id
      );

    if (
      !client
    ) {
      return;
    }

    const relation =
      client
        .client_companies
        ?.find(
          (
            item
          ) =>
            item.status ===
            "active"
        );

    if (
      relation
    ) {
      setCompanyId(
        relation.company_id
      );
    }
  }

  /*
   * =====================================================
   * EMPRESA
   * =====================================================
   */

  function handleCompanyChange(
    id:
      string
  ) {
    setRenewalLocked(
      false
    );

    setCompanyId(
      id
    );

    setProductId(
      ""
    );

    setTitle(
      ""
    );

    setValue(
      ""
    );

    setSelectedTvIds(
      []
    );
  }

  /*
   * =====================================================
   * PRODUTO
   * =====================================================
   */

  function handleProductChange(
    id:
      string
  ) {
    setProductId(
      id
    );

    const product =
      products.find(
        (
          item
        ) =>
          item.id ===
          id
      );

    if (
      !product
    ) {
      return;
    }

    setTitle(
      product.name
    );

    if (
      product.default_price !==
      null
    ) {
      setValue(
        formatMoneyInput(
          Number(
            product.default_price
          )
        )
      );
    }

    if (
      product.billing_frequency
    ) {
      setBillingFrequency(
        product.billing_frequency as BillingFrequency
      );
    }
  }

  /*
   * =====================================================
   * TVs
   * =====================================================
   */

  function toggleTv(
    tvId:
      string
  ) {
    setSelectedTvIds(
      (
        current
      ) =>
        current.includes(
          tvId
        )
          ? current.filter(
              (
                id
              ) =>
                id !==
                tvId
            )
          : [
              ...current,
              tvId,
            ]
    );
  }

  function selectAllTvs() {
    setSelectedTvIds(
      tvs.map(
        (tv) => tv.id
      )
    );
  }

  function clearTvs() {
    setSelectedTvIds(
      []
    );
  }

  /*
   * =====================================================
   * VALOR
   * =====================================================
   */

  const numericValue =
    useMemo(
      () =>
        parseMoney(
          value
        ),
      [
        value,
      ]
    );

  /*
   * =====================================================
   * PARCELAS AUTOMÁTICAS
   * =====================================================
   */

  useEffect(
    () => {
      if (
        !Number.isFinite(
          numericValue
        ) ||
        numericValue <=
          0 ||
        installments <
          1
      ) {
        setInstallmentValues(
          Array.from(
            {
              length:
                Math.max(
                  installments,
                  1
                ),
            },
            () =>
              ""
          )
        );

        return;
      }

      const distributed =
        distributeAmount(
          numericValue,
          installments
        );

      setInstallmentValues(
        distributed.map(
          (
            amount
          ) =>
            formatMoneyInput(
              amount
            )
        )
      );
    },
    [
      numericValue,
      installments,
    ]
  );

  /*
   * =====================================================
   * DATAS DAS PARCELAS (recalcula quando muda o 1º
   * vencimento, o intervalo ou a quantidade)
   * =====================================================
   */

  useEffect(
    () => {
      setInstallmentDues(
        buildDueDates(
          firstDueDate,
          Math.max(
            installments,
            1
          ),
          intervalDays
        )
      );
    },
    [
      firstDueDate,
      installments,
      intervalDays,
    ]
  );

  /*
   * =====================================================
   * COMISSÃO PREVISTA
   * =====================================================
   */

  const commissionPreview =
    useMemo(
      () => {
        if (
          !currentSellerSetting ||
          !Number.isFinite(
            numericValue
          ) ||
          numericValue <=
            0 ||
          !Number.isFinite(
            commissionPercentage
          )
        ) {
          return 0;
        }

        return roundMoney(
          numericValue *
            (
              commissionPercentage /
              100
            )
        );
      },
      [
        numericValue,
        commissionPercentage,
        currentSellerSetting,
      ]
    );

  /*
   * =====================================================
   * TOTAL DAS PARCELAS
   * =====================================================
   */

  const installmentsTotal =
    useMemo(
      () =>
        roundMoney(
          installmentValues.reduce(
            (
              total,
              amount
            ) =>
              total +
              parseMoney(
                amount
              ),
            0
          )
        ),
      [
        installmentValues,
      ]
    );

  const installmentsDifference =
    roundMoney(
      numericValue -
        installmentsTotal
    );

  const installmentsBalanced =
    Number.isFinite(
      numericValue
    ) &&
    numericValue >
      0 &&
    Math.abs(
      installmentsDifference
    ) <
      0.01;

  /*
   * =====================================================
   * CADASTRAR CLIENTE
   * =====================================================
   */

  async function handleCreateClient() {
    setError("");

    if (
      !companyId
    ) {
      setError(
        "Selecione primeiro a empresa do contrato."
      );

      return;
    }

    if (
      !newClientName.trim()
    ) {
      setError(
        "Informe o nome do cliente."
      );

      return;
    }

    if (
      !newClientDocument.trim()
    ) {
      setError(
        "Informe o CPF ou CNPJ do cliente."
      );

      return;
    }

    if (
      !newClientPhone.trim() &&
      !newClientWhatsapp.trim()
    ) {
      setError(
        "Informe um telefone ou WhatsApp do cliente."
      );

      return;
    }

    setCreatingClient(
      true
    );

    const {
      data:
        createdClient,
      error:
        createClientError,
    } =
      await supabase
        .from(
          "clients"
        )
        .insert({
          type:
            newClientType,

          name:
            newClientName.trim(),

          trade_name:
            newClientTradeName
              .trim() ||
            null,

          cpf_cnpj:
            newClientDocument
              .trim() ||
            null,

          email:
            newClientEmail
              .trim() ||
            null,

          phone:
            newClientPhone
              .trim() ||
            null,

          whatsapp:
            newClientWhatsapp
              .trim() ||
            null,

          active:
            true,
        })
        .select(`
          id,
          name
        `)
        .single();

    if (
      createClientError ||
      !createdClient
    ) {
      setError(
        createClientError
          ?.message ??
          "Não foi possível cadastrar o cliente."
      );

      setCreatingClient(
        false
      );

      return;
    }

    const {
      error:
        relationError,
    } =
      await supabase
        .from(
          "client_companies"
        )
        .insert({
          client_id:
            createdClient.id,

          company_id:
            companyId,

          status:
            "active",

          notes:
            null,
        });

    if (
      relationError
    ) {
      await supabase
        .from(
          "clients"
        )
        .delete()
        .eq(
          "id",
          createdClient.id
        );

      setError(
        relationError.message
      );

      setCreatingClient(
        false
      );

      return;
    }

    const newClient:
      Client = {
      id:
        createdClient.id,

      name:
        createdClient.name,

      client_companies: [
        {
          company_id:
            companyId,

          status:
            "active",
        },
      ],
    };

    setClients(
      (
        current
      ) =>
        [
          ...current,
          newClient,
        ].sort(
          (
            a,
            b
          ) =>
            a.name.localeCompare(
              b.name,
              "pt-BR"
            )
        )
    );

    setClientId(
      createdClient.id
    );

    setShowNewClient(
      false
    );

    setNewClientType(
      "company"
    );

    setNewClientName("");
    setNewClientTradeName("");
    setNewClientDocument("");
    setNewClientEmail("");
    setNewClientPhone("");
    setNewClientWhatsapp("");

    setCreatingClient(
      false
    );
  }

  /*
   * =====================================================
   * PARCELA MANUAL
   * =====================================================
   */

  function handleInstallmentValueChange(
    index:
      number,
    newValue:
      string
  ) {
    setInstallmentValues(
      (
        current
      ) =>
        current.map(
          (
            installment,
            itemIndex
          ) =>
            itemIndex ===
            index
              ? newValue
              : installment
        )
    );
  }

  function handleInstallmentDueChange(
    index: number,
    newDue: string
  ) {
    setInstallmentDues(
      (current) =>
        current.map(
          (due, itemIndex) =>
            itemIndex === index
              ? newDue
              : due
        )
    );
  }

  /*
   * =====================================================
   * SUBMIT
   * =====================================================
   */

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");

    if (
      !currentUser
    ) {
      setError(
        "Usuário não autenticado."
      );

      return;
    }

    if (
      !clientId
    ) {
      setError(
        "Selecione um cliente."
      );

      return;
    }

    if (
      !companyId
    ) {
      setError(
        "Selecione uma empresa."
      );

      return;
    }

    if (
      !courtesy &&
      !currentSellerSetting
    ) {
      setError(
        "Seu usuário não está configurado para receber comissão nesta empresa."
      );

      return;
    }

    if (
      !title.trim()
    ) {
      setError(
        "Informe o título do contrato."
      );

      return;
    }

    if (
      !startDate
    ) {
      setError(
        "Informe a data de início."
      );

      return;
    }

    if (
      !courtesy &&
      !firstDueDate
    ) {
      setError(
        "Informe o primeiro vencimento."
      );

      return;
    }

    if (
      !courtesy &&
      !paymentMethodId
    ) {
      setError(
        "Selecione a forma de pagamento."
      );

      return;
    }

    if (
      !courtesy &&
      (
        !Number.isFinite(
          numericValue
        ) ||
        numericValue <=
          0
      )
    ) {
      setError(
        "Informe um valor válido."
      );

      return;
    }

    if (
      !courtesy &&
      installments <
      1
    ) {
      setError(
        "A quantidade de parcelas deve ser pelo menos 1."
      );

      return;
    }

    let parsedInstallmentValues:
      number[] = [];

    if (!courtesy) {
      if (
        installmentValues.length !==
        installments
      ) {
        setError(
          "Os valores das parcelas estão inconsistentes."
        );

        return;
      }

      parsedInstallmentValues =
        installmentValues.map(
          (amount) =>
            parseMoney(amount)
        );

      if (
        parsedInstallmentValues.some(
          (amount) =>
            !Number.isFinite(
              amount
            ) ||
            amount <= 0
        )
      ) {
        setError(
          "Informe um valor válido para todas as parcelas."
        );

        return;
      }

      const parsedInstallmentTotal =
        roundMoney(
          parsedInstallmentValues.reduce(
            (total, amount) =>
              total + amount,
            0
          )
        );

      if (
        Math.abs(
          parsedInstallmentTotal -
            numericValue
        ) >= 0.01
      ) {
        setError(
          `A soma das parcelas precisa ser exatamente ${formatCurrency(
            numericValue
          )}.`
        );

        return;
      }

      if (
        installmentDues.length !==
          installments ||
        installmentDues.some(
          (due) => !due
        )
      ) {
        setError(
          "Informe a data de vencimento de todas as parcelas."
        );

        return;
      }
    }

    setLoading(
      true
    );

    const result =
      await createContract({
        clientId,

        companyId,

        productId:
          productId ||
          null,

        title:
          title.trim(),

        startDate,

        endDate:
          endDate ||
          null,

        firstDueDate:
          courtesy
            ? startDate
            : firstDueDate,

        value:
          courtesy ? 0 : numericValue,

        courtesy,

        billingFrequency,

        paymentMethodId:
          courtesy
            ? ""
            : paymentMethodId,

        installments:
          courtesy ? 1 : installments,

        installmentValues:
          courtesy
            ? []
            : parsedInstallmentValues,

        installmentDues:
          courtesy
            ? []
            : installmentDues,

        autoRenew,

        tvIds:
          companyId ===
          POTTENCIALIZA_COMPANY_ID
            ? selectedTvIds
            : [],

        deliveryRouteId:
          deliveryRouteId || null,

        notes:
          notes.trim() ||
          null,
      });

    if (
      !result.success
    ) {
      setError(
        result.error ??
          "Não foi possível criar o contrato."
      );

      setLoading(
        false
      );

      return;
    }

    if (
      renewal &&
      result.contractId
    ) {
      /*
       * Registra no contrato de origem a
       * referência ao novo contrato. Uma
       * falha aqui não bloqueia o fluxo —
       * o novo contrato já nasce com a
       * referência ao antigo em `notes`.
       */
      await linkRenewalContracts(
        renewal.sourceContractId,
        result.contractId
      );

      router.push(
        `/contratos/${result.contractId}`
      );

      router.refresh();

      return;
    }

    router.push(
      "/contratos"
    );

    router.refresh();
  }

  /*
   * =====================================================
   * RENDER
   * =====================================================
   */

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <form
        onSubmit={
          handleSubmit
        }
        className="mx-auto max-w-5xl"
      >
        {/* VOLTAR */}

        <button
          type="button"
          onClick={() =>
            router.back()
          }
          className="mb-5 flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />

          Voltar
        </button>

        {/* HEADER */}

        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {isRenewal
                ? "Renovar contrato"
                : "Novo contrato"}
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              {isRenewal
                ? "Confira e ajuste os dados abaixo antes de confirmar. Um novo contrato será criado e vinculado ao contrato de origem."
                : "Cadastre primeiro a venda/contrato. As publicações serão vinculadas às edições posteriormente."}
            </p>
          </div>

          <button
            type="submit"
            disabled={
              loading ||
              userLoading
            }
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#15704f] px-5 text-sm font-semibold text-white transition hover:bg-[#105c41] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" />

            {loading
              ? "Salvando..."
              : isRenewal
              ? "Confirmar renovação"
              : "Salvar contrato"}
          </button>
        </div>

        {/* ERRO */}

        {error && (
          <div className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {
              error
            }
          </div>
        )}

        {/* =================================================
            INFORMAÇÕES PRINCIPAIS
           ================================================= */}

        <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-900">
            Informações principais
          </h2>

          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field label="Empresa">
              <select
                value={
                  companyId
                }
                onChange={(
                  event
                ) =>
                  handleCompanyChange(
                    event.target.value
                  )
                }
                required
                className="input"
              >
                <option value="">
                  Selecione...
                </option>

                {companies.map(
                  (
                    company
                  ) => (
                    <option
                      key={
                        company.id
                      }
                      value={
                        company.id
                      }
                    >
                      {
                        company.name
                      }
                    </option>
                  )
                )}
              </select>
            </Field>

            {/* CLIENTE */}

            <div>
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-medium text-slate-700">
                  Cliente
                </label>

                <button
                  type="button"
                  onClick={() => {
                    if (
                      !companyId
                    ) {
                      setError(
                        "Selecione primeiro a empresa para cadastrar o cliente."
                      );

                      return;
                    }

                    setError("");

                    setShowNewClient(
                      true
                    );
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#15704f] transition hover:text-[#105c41]"
                >
                  <UserPlus className="h-3.5 w-3.5" />

                  Novo cliente
                </button>
              </div>

              <ClientCombobox
                clients={clients.map(
                  (client) => ({
                    id: client.id,
                    name: client.name,
                  })
                )}
                value={clientId}
                onChange={
                  handleClientChange
                }
              />
            </div>

            {/* PRODUTO */}

            <Field label="Produto / Serviço">
              <select
                value={
                  productId
                }
                onChange={(
                  event
                ) =>
                  handleProductChange(
                    event.target.value
                  )
                }
                className="input"
              >
                <option value="">
                  Sem produto específico
                </option>

                {availableProducts.map(
                  (
                    product
                  ) => (
                    <option
                      key={
                        product.id
                      }
                      value={
                        product.id
                      }
                    >
                      {
                        product.name
                      }
                    </option>
                  )
                )}
              </select>
            </Field>

            {/* TÍTULO */}

            <Field label="Título">
              <input
                value={
                  title
                }
                onChange={(
                  event
                ) =>
                  setTitle(
                    event.target.value
                  )
                }
                required
                className="input"
              />
            </Field>

            {/* VALOR */}

            <Field label="Valor total">
              <input
                value={
                  courtesy
                    ? "0,00 (cortesia)"
                    : value
                }
                onChange={(
                  event
                ) =>
                  setValue(
                    event.target.value
                  )
                }
                placeholder="0,00"
                inputMode="decimal"
                required={!courtesy}
                disabled={courtesy}
                className="input disabled:bg-slate-50 disabled:text-slate-400"
              />

              <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={courtesy}
                  onChange={(event) =>
                    setCourtesy(
                      event.target.checked
                    )
                  }
                  className="h-4 w-4"
                />
                Cortesia — o cliente ganha (sem cobrança, sem parcelas, sem comissão)
              </label>
            </Field>

            {/* PERIODICIDADE */}

            <Field label="Periodicidade do contrato">
              <select
                value={
                  billingFrequency
                }
                onChange={(
                  event
                ) =>
                  setBillingFrequency(
                    event.target.value as BillingFrequency
                  )
                }
                className="input"
              >
                <option value="one_time">
                  Pagamento único
                </option>

                <option value="monthly">
                  Mensal
                </option>

                <option value="quarterly">
                  Trimestral
                </option>

                <option value="semiannual">
                  Semestral
                </option>

                <option value="annual">
                  Anual
                </option>

                <option value="custom">
                  Personalizado
                </option>
              </select>
            </Field>
          </div>
        </section>

        {/* =================================================
            RESPONSÁVEL / COMISSÃO
           ================================================= */}

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#15704f]/10">
              <UserRound className="h-5 w-5 text-[#15704f]" />
            </div>

            <div>
              <h2 className="font-semibold text-slate-900">
                Responsável e comissão
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                O responsável pelo contrato é automaticamente o usuário que está criando o registro.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {/* RESPONSÁVEL */}

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Responsável pelo contrato
              </p>

              {userLoading ? (
                <p className="mt-3 text-sm text-slate-500">
                  Carregando usuário...
                </p>
              ) : currentUser ? (
                <>
                  <p className="mt-3 text-sm font-semibold text-slate-900">
                    {
                      currentUser.name
                    }
                  </p>

                  {currentUser.email &&
                    currentUser.email !==
                      currentUser.name && (
                      <p className="mt-1 text-xs text-slate-500">
                        {
                          currentUser.email
                        }
                      </p>
                    )}

                  <div className="mt-3 inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    Usuário autenticado
                  </div>
                </>
              ) : (
                <p className="mt-3 text-sm text-red-600">
                  Usuário não identificado.
                </p>
              )}
            </div>

            {/* COMISSÃO */}

            <div className="rounded-xl border border-[#15704f]/10 bg-[#15704f]/5 p-4">
              <div className="flex items-center gap-2">
                <BadgePercent className="h-4 w-4 text-[#15704f]" />

                <p className="text-xs font-medium uppercase tracking-wide text-[#15704f]">
                  Comissão prevista
                </p>
              </div>

              {!companyId ? (
                <p className="mt-3 text-sm text-slate-500">
                  Selecione uma empresa para verificar sua comissão.
                </p>
              ) : !currentSellerSetting ? (
                <>
                  <p className="mt-3 text-sm font-semibold text-amber-700">
                    Comissão não configurada
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Seu usuário não possui uma configuração de comissão ativa para esta empresa.
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-3 text-xl font-semibold text-slate-900">
                    {formatCurrency(
                      commissionPreview
                    )}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {formatPercentage(
                      commissionPercentage
                    )}{" "}
                    sobre{" "}
                    {formatCurrency(
                      numericValue
                    )}
                  </p>

                  {commissionSource ===
                  "product" ? (
                    <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                      <p className="text-xs font-medium text-blue-700">
                        Comissão definida pelo produto
                      </p>

                      <p className="mt-1 text-xs text-blue-600">
                        {
                          selectedProduct?.name
                        }
                        {" • "}
                        {formatPercentage(
                          commissionPercentage
                        )}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-3 rounded-lg border border-slate-200 bg-white/70 px-3 py-2">
                      <p className="text-xs font-medium text-slate-600">
                        Comissão padrão do responsável
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        O produto não possui uma comissão específica configurada.
                      </p>
                    </div>
                  )}

                  {commissionPercentage ===
                  0 ? (
                    <p className="mt-3 text-xs font-medium text-amber-700">
                      Este contrato não gerará comissão principal.
                    </p>
                  ) : (
                    <p className="mt-3 text-xs text-slate-400">
                      A comissão será liberada proporcionalmente conforme o cliente efetivamente pagar cada parcela.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </section>

        {/* =================================================
            TVs
           ================================================= */}

        {companyId ===
          POTTENCIALIZA_COMPANY_ID && (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <h2 className="font-semibold text-slate-900">
                  TVs / Telões vinculados
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Selecione em quais pontos este contrato será exibido.
                </p>
              </div>

              {tvs.length > 0 && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={
                      selectAllTvs
                    }
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    Selecionar todas
                  </button>

                  <button
                    type="button"
                    onClick={
                      clearTvs
                    }
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    Limpar
                  </button>
                </div>
              )}
            </div>

            {tvs.length >
            0 ? (
              <>
                <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {tvs.map(
                    (
                      tv
                    ) => {
                      const selected =
                        selectedTvIds.includes(
                          tv.id
                        );

                      return (
                        <button
                          key={
                            tv.id
                          }
                          type="button"
                          onClick={() =>
                            toggleTv(
                              tv.id
                            )
                          }
                          className={`rounded-xl border p-4 text-left transition ${
                            selected
                              ? "border-[#15704f] bg-[#15704f]/5"
                              : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={
                                selected
                              }
                              readOnly
                              className="mt-0.5 h-4 w-4 accent-[#15704f]"
                            />

                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900">
                                {
                                  tv.name
                                }
                              </p>

                              <p className="mt-1 text-xs text-slate-500">
                                {tv.location ||
                                  "Localização não informada"}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    }
                  )}
                </div>

                <div className="mt-5 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                  <span className="text-sm text-slate-500">
                    Pontos selecionados
                  </span>

                  <span className="text-sm font-semibold text-[#15704f]">
                    {
                      selectedTvIds.length
                    }{" "}
                    de{" "}
                    {
                      tvs.length
                    }
                  </span>
                </div>
              </>
            ) : (
              <div className="mt-5 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Nenhuma TV ativa cadastrada.
              </div>
            )}
          </section>
        )}

        {/* =================================================
            VIGÊNCIA
           ================================================= */}

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-900">
            Vigência
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Período em que o contrato estará em vigor.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field label="Data de início">
              <input
                type="date"
                value={
                  startDate
                }
                onChange={(
                  event
                ) =>
                  setStartDate(
                    event.target.value
                  )
                }
                required
                className="input"
              />
            </Field>

            <Field label="Data de término">
              <input
                type="date"
                value={
                  endDate
                }
                onChange={(
                  event
                ) =>
                  setEndDate(
                    event.target.value
                  )
                }
                className="input"
              />
            </Field>
          </div>

          <label className="mt-6 flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <input
              type="checkbox"
              checked={
                autoRenew
              }
              onChange={(
                event
              ) =>
                setAutoRenew(
                  event.target.checked
                )
              }
              className="h-4 w-4"
            />

            <div>
              <p className="text-sm font-medium text-slate-700">
                Renovação automática
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Indica que o contrato poderá ser renovado ao fim da vigência.
              </p>
            </div>
          </label>
        </section>

        {/* =================================================
            COBRANÇA
           ================================================= */}

        {courtesy ? (
          <section className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
            Contrato de cortesia — sem forma de pagamento, parcelas ou comissão.
          </section>
        ) : (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#15704f]/10">
              <CreditCard className="h-5 w-5 text-[#15704f]" />
            </div>

            <div>
              <h2 className="font-semibold text-slate-900">
                Condições de cobrança
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Defina como o cliente realizará o pagamento.
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
            <Field label="Forma de pagamento">
              <select
                value={
                  paymentMethodId
                }
                onChange={(
                  event
                ) =>
                  setPaymentMethodId(
                    event.target.value
                  )
                }
                required
                className="input"
              >
                <option value="">
                  Selecione...
                </option>

                {paymentMethods.map(
                  (
                    method
                  ) => (
                    <option
                      key={
                        method.id
                      }
                      value={
                        method.id
                      }
                    >
                      {
                        method.name
                      }
                    </option>
                  )
                )}
              </select>
            </Field>

            <Field label="Quantidade de parcelas">
              <input
                type="number"
                min={
                  1
                }
                max={
                  120
                }
                value={
                  installments
                }
                onChange={(
                  event
                ) =>
                  setInstallments(
                    Math.max(
                      1,
                      Number(
                        event.target.value
                      ) ||
                        1
                    )
                  )
                }
                required
                className="input"
              />
            </Field>

            <Field label="1º vencimento">
              <input
                type="date"
                value={
                  firstDueDate
                }
                onChange={(
                  event
                ) =>
                  setFirstDueDate(
                    event.target.value
                  )
                }
                required
                className="input"
              />
            </Field>

            <Field label="Intervalo entre parcelas (dias)">
              <input
                type="number"
                min={
                  1
                }
                max={
                  365
                }
                value={
                  intervalDays
                }
                onChange={(
                  event
                ) =>
                  setIntervalDays(
                    Math.max(
                      1,
                      Number(
                        event.target.value
                      ) ||
                        30
                    )
                  )
                }
                className="input"
              />
            </Field>

            {availableRoutes.length > 0 && (
              <Field label="Rota de entrega (opcional)">
                <select
                  value={
                    deliveryRouteId
                  }
                  onChange={(
                    event
                  ) =>
                    setDeliveryRouteId(
                      event.target.value
                    )
                  }
                  className="input"
                >
                  <option value="">
                    Não vincular a nenhuma rota
                  </option>

                  {availableRoutes.map(
                    (route) => (
                      <option
                        key={route.id}
                        value={route.id}
                      >
                        {route.name}
                        {route.region
                          ? ` — ${route.region}`
                          : ""}
                      </option>
                    )
                  )}
                </select>

                <p className="mt-1 text-xs text-slate-400">
                  O cliente entra nessa rota com o endereço principal. Dá para reordenar depois em Rotas.
                </p>
              </Field>
            )}
          </div>

          {Number.isFinite(
            numericValue
          ) &&
            numericValue >
              0 &&
            installments >
              0 && (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Valores das parcelas
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Valores e datas são preenchidos automaticamente, mas podem ser ajustados um a um.
                    </p>
                  </div>

                  <p
                    className={`text-sm font-semibold ${
                      installmentsBalanced
                        ? "text-emerald-700"
                        : "text-red-600"
                    }`}
                  >
                    Soma:{" "}
                    {formatCurrency(
                      installmentsTotal
                    )}
                  </p>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {installmentValues.map(
                    (
                      installmentValue,
                      index
                    ) => (
                      <div
                        key={
                          index
                        }
                        className="rounded-xl border border-slate-200 bg-white p-4"
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Parcela{" "}
                          {
                            index +
                            1
                          }
                        </p>

                        <label className="mt-3 block text-[11px] font-medium text-slate-400">
                          Vencimento
                          <input
                            type="date"
                            value={
                              installmentDues[
                                index
                              ] ?? ""
                            }
                            onChange={(
                              event
                            ) =>
                              handleInstallmentDueChange(
                                index,
                                event.target.value
                              )
                            }
                            className="input mt-1"
                          />
                        </label>

                        <label className="mt-3 block text-[11px] font-medium text-slate-400">
                          Valor
                          <div className="relative mt-1">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                              R$
                            </span>

                            <input
                              value={
                                installmentValue
                              }
                              onChange={(
                                event
                              ) =>
                                handleInstallmentValueChange(
                                  index,
                                  event.target.value
                                )
                              }
                              inputMode="decimal"
                              className="input pl-10"
                            />
                          </div>
                        </label>
                      </div>
                    )
                  )}
                </div>

                {!installmentsBalanced && (
                  <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                    <p className="text-sm font-medium text-red-700">
                      A soma das parcelas precisa ser{" "}
                      {formatCurrency(
                        numericValue
                      )}
                      .
                    </p>

                    <p className="mt-1 text-xs text-red-600">
                      Diferença:{" "}
                      {formatCurrency(
                        Math.abs(
                          installmentsDifference
                        )
                      )}
                    </p>
                  </div>
                )}
              </div>
            )}
        </section>
        )}

        {/* OBSERVAÇÕES */}

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <Field label="Observações">
            <textarea
              value={
                notes
              }
              onChange={(
                event
              ) =>
                setNotes(
                  event.target.value
                )
              }
              rows={
                5
              }
              className="input min-h-[130px]"
            />
          </Field>
        </section>

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={
              loading ||
              userLoading ||
              (!courtesy &&
                !installmentsBalanced)
            }
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#15704f] px-6 text-sm font-semibold text-white transition hover:bg-[#105c41] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />

            {loading
              ? "Salvando..."
              : isRenewal
              ? "Confirmar renovação"
              : "Salvar contrato"}
          </button>
        </div>
      </form>

      {/* =================================================
          MODAL CLIENTE
         ================================================= */}

      {showNewClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="font-semibold text-slate-900">
                  Novo cliente
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  O cliente será vinculado automaticamente à empresa selecionada.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowNewClient(
                    false
                  )
                }
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-6">
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Tipo">
                  <select
                    value={
                      newClientType
                    }
                    onChange={(
                      event
                    ) =>
                      setNewClientType(
                        event.target.value as
                          | "individual"
                          | "company"
                      )
                    }
                    className="input"
                  >
                    <option value="company">
                      Pessoa jurídica
                    </option>

                    <option value="individual">
                      Pessoa física
                    </option>
                  </select>
                </Field>

                <Field
                  label={
                    newClientType ===
                    "company"
                      ? "Razão social / Nome"
                      : "Nome"
                  }
                >
                  <input
                    value={
                      newClientName
                    }
                    onChange={(
                      event
                    ) =>
                      setNewClientName(
                        event.target.value
                      )
                    }
                    className="input"
                  />
                </Field>

                {newClientType ===
                  "company" && (
                  <Field label="Nome fantasia">
                    <input
                      value={
                        newClientTradeName
                      }
                      onChange={(
                        event
                      ) =>
                        setNewClientTradeName(
                          event.target.value
                        )
                      }
                      className="input"
                    />
                  </Field>
                )}

                <Field
                  label={
                    newClientType ===
                    "company"
                      ? "CNPJ"
                      : "CPF"
                  }
                >
                  <input
                    value={
                      newClientDocument
                    }
                    onChange={(
                      event
                    ) =>
                      setNewClientDocument(
                        event.target.value
                      )
                    }
                    className="input"
                  />
                </Field>

                <Field label="E-mail">
                  <input
                    type="email"
                    value={
                      newClientEmail
                    }
                    onChange={(
                      event
                    ) =>
                      setNewClientEmail(
                        event.target.value
                      )
                    }
                    className="input"
                  />
                </Field>

                <Field label="Telefone">
                  <input
                    value={
                      newClientPhone
                    }
                    onChange={(
                      event
                    ) =>
                      setNewClientPhone(
                        event.target.value
                      )
                    }
                    className="input"
                  />
                </Field>

                <Field label="WhatsApp">
                  <input
                    value={
                      newClientWhatsapp
                    }
                    onChange={(
                      event
                    ) =>
                      setNewClientWhatsapp(
                        event.target.value
                      )
                    }
                    className="input"
                  />
                </Field>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-5">
              <button
                type="button"
                onClick={() =>
                  setShowNewClient(
                    false
                  )
                }
                className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-600"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={
                  creatingClient
                }
                onClick={
                  handleCreateClient
                }
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#15704f] px-5 text-sm font-semibold text-white disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />

                {creatingClient
                  ? "Cadastrando..."
                  : "Cadastrar cliente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/*
 * =====================================================
 * FIELD
 * =====================================================
 */

function Field({
  label,
  children,
}: {
  label:
    string;

  children:
    React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {
          label
        }
      </span>

      {
        children
      }
    </label>
  );
}

/*
 * =====================================================
 * DATA
 * =====================================================
 */

function getToday() {
  const now =
    new Date();

  return [
    now.getFullYear(),

    String(
      now.getMonth() +
        1
    ).padStart(
      2,
      "0"
    ),

    String(
      now.getDate()
    ).padStart(
      2,
      "0"
    ),
  ].join(
    "-"
  );
}

/*
 * =====================================================
 * DINHEIRO
 * =====================================================
 */

function parseMoney(
  value:
    string
) {
  const clean =
    value
      .trim()
      .replace(
        /\s/g,
        ""
      );

  if (
    !clean
  ) {
    return 0;
  }

  if (
    clean.includes(
      ","
    )
  ) {
    return (
      Number(
        clean
          .replace(
            /\./g,
            ""
          )
          .replace(
            ",",
            "."
          )
      ) ||
      0
    );
  }

  return (
    Number(
      clean
    ) ||
    0
  );
}

function formatMoneyInput(
  value:
    number
) {
  return new Intl.NumberFormat(
    "pt-BR",
    {
      minimumFractionDigits:
        2,

      maximumFractionDigits:
        2,
    }
  ).format(
    value
  );
}

function roundMoney(
  value:
    number
) {
  return (
    Math.round(
      (
        Number(
          value
        ) +
        Number.EPSILON
      ) *
        100
    ) /
    100
  );
}

function formatCurrency(
  value:
    number
) {
  return new Intl.NumberFormat(
    "pt-BR",
    {
      style:
        "currency",

      currency:
        "BRL",
    }
  ).format(
    Number.isFinite(
      value
    )
      ? value
      : 0
  );
}

function formatPercentage(
  value:
    number
) {
  return (
    new Intl.NumberFormat(
      "pt-BR",
      {
        maximumFractionDigits:
          2,
      }
    ).format(
      Number.isFinite(
        value
      )
          ? value
          : 0
    ) +
    "%"
  );
}

/*
 * =====================================================
 * DISTRIBUIR PARCELAS
 * =====================================================
 */

function distributeAmount(
  total:
    number,
  installments:
    number
) {
  const totalInCents =
    Math.round(
      total *
        100
    );

  const base =
    Math.floor(
      totalInCents /
        installments
    );

  const remainder =
    totalInCents %
    installments;

  return Array.from(
    {
      length:
        installments,
    },
    (
      _,
      index
    ) =>
      (
        base +
        (
          index <
          remainder
            ? 1
            : 0
        )
      ) /
      100
  );
}

/*
 * =====================================================
 * DATA DAS PARCELAS
 * =====================================================
 */

function addMonthsClamped(
  date:
    string,
  monthsToAdd:
    number
) {
  if (
    !date
  ) {
    return "";
  }

  const [
    year,
    month,
    day,
  ] =
    date
      .split(
        "-"
      )
      .map(
        Number
      );

  const target =
    new Date(
      Date.UTC(
        year,
        month -
          1 +
          monthsToAdd,
        1
      )
    );

  const finalYear =
    target.getUTCFullYear();

  const finalMonth =
    target.getUTCMonth();

  const lastDay =
    new Date(
      Date.UTC(
        finalYear,
        finalMonth +
          1,
        0
      )
    ).getUTCDate();

  const finalDay =
    Math.min(
      day,
      lastDay
    );

  return [
    String(
      finalYear
    ),

    String(
      finalMonth +
        1
    ).padStart(
      2,
      "0"
    ),

    String(
      finalDay
    ).padStart(
      2,
      "0"
    ),
  ].join(
    "-"
  );
}

function formatDateBr(
  date:
    string
) {
  if (
    !date
  ) {
    return "—";
  }

  const [
    year,
    month,
    day,
  ] =
    date.split(
      "-"
    );

  return `${day}/${month}/${year}`;
}