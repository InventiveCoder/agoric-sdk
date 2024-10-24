/**
 * @file build core eval script to replace EC committee and charter
 * Usage:
 *   To run this script, use the following command format in the CLI:
 *   agoric run replace-electorate-core.js [ENVIRONMENT]
 *   where [ENVIRONMENT] is one of the following:
 *     - MAINNET
 *     - DEVNET
 *     - A3P_INTEGRATION
 *     - BOOTSTRAP_TEST
 *
 *   Example:
 *     agoric run replace-electorate-core.js MAINNET
 */
/* global process */
import { makeHelpers } from '@agoric/deploy-script-support';
import { getManifestForReplaceAllElectorates } from '@agoric/inter-protocol/src/proposals/replaceElectorate.js';

const configurations = {
  MAINNET: {
    committeeName: 'Economic Committee',
    voterAddresses: {
      'Chloe White': 'agoric1d4228cvelf8tj65f4h7n2td90sscavln2283h5',
      'Chris Berg': 'agoric13p9adwk0na5npfq64g22l6xucvqdmu3xqe70wq',
      'Joe Clark': 'agoric1zayxg4e9vd0es9c9jlpt36qtth255txjp6a8yc',
    },
    highPrioritySendersConfig: {
      addressesToAdd: [],
      addressesToRemove: [
        'agoric1gx9uu7y6c90rqruhesae2t7c2vlw4uyyxlqxrx',
        'agoric14543m33dr28x7qhwc558hzlj9szwhzwzpcmw6a',
        'agoric1el6zqs8ggctj5vwyukyk4fh50wcpdpwgugd5l5',
      ],
    },
  },
  DEVNET: {
    committeeName: 'Economic Committee',
    voterAddresses: {
      gov1: 'agoric1ldmtatp24qlllgxmrsjzcpe20fvlkp448zcuce',
      gov2: 'agoric140dmkrz2e42ergjj7gyvejhzmjzurvqeq82ang',
      gov4: 'agoric1f0h5zgxyg3euxsqzs0506uj4cmu56y30pqx46s',
    },
    highPrioritySendersConfig: {
      addressesToAdd: ['agoric1f0h5zgxyg3euxsqzs0506uj4cmu56y30pqx46s'],
      addressesToRemove: ['agoric1w8wktaur4zf8qmmtn3n7x3r0jhsjkjntcm3u6h'],
    },
  },
  A3P_INTEGRATION: {
    committeeName: 'Economic Committee',
    voterAddresses: {
      gov1: 'agoric1ee9hr0jyrxhy999y755mp862ljgycmwyp4pl7q',
      gov2: 'agoric1wrfh296eu2z34p6pah7q04jjuyj3mxu9v98277',
      gov4: 'agoric1c9gyu460lu70rtcdp95vummd6032psmpdx7wdy',
    },
    highPrioritySendersConfig: {
      addressesToAdd: ['agoric1c9gyu460lu70rtcdp95vummd6032psmpdx7wdy'],
      addressesToRemove: ['agoric1ydzxwh6f893jvpaslmaz6l8j2ulup9a7x8qvvq'],
    },
  },
  BOOTSTRAP_TEST: {
    committeeName: 'Economic Committee',
    voterAddresses: {
      gov1: 'agoric1gx9uu7y6c90rqruhesae2t7c2vlw4uyyxlqxrx',
      gov2: 'agoric1d4228cvelf8tj65f4h7n2td90sscavln2283h5',
      gov3: 'agoric14543m33dr28x7qhwc558hzlj9szwhzwzpcmw6a',
    },
    highPrioritySendersConfig: {
      addressesToAdd: [],
      addressesToRemove: [
        'agoric13p9adwk0na5npfq64g22l6xucvqdmu3xqe70wq',
        'agoric1el6zqs8ggctj5vwyukyk4fh50wcpdpwgugd5l5',
        'agoric1zayxg4e9vd0es9c9jlpt36qtth255txjp6a8yc',
      ],
    },
  },
};

const { keys } = Object;
const Usage = `agoric run replace-electorate-core.js ${keys(configurations).join(' | ')}`;
/** @type {import('@agoric/deploy-script-support/src/externalTypes.js').CoreEvalBuilder} */
export const defaultProposalBuilder = async ({ publishRef, install }, opts) => {
  const config = configurations[opts.variant];
  if (!config) {
    console.error(Usage);
    process.exit(1);
  }
  return harden({
    sourceSpec: '@agoric/inter-protocol/src/proposals/replaceElectorate.js',
    getManifestCall: [
      getManifestForReplaceAllElectorates.name,
      {
        ...config,
        economicCommitteeRef: publishRef(
          install(
            '@agoric/governance/src/committee.js',
            '../bundles/bundle-committee.js',
          ),
        ),
      },
    ],
  });
};

/** @type {import('@agoric/deploy-script-support/src/externalTypes.js').DeployScriptFunction} */
export default async (homeP, endowments) => {
  const { scriptArgs } = endowments;
  const variant = scriptArgs?.[0];
  console.log('replace-committee', scriptArgs, variant);

  const { writeCoreEval } = await makeHelpers(homeP, endowments);

  await writeCoreEval(`replace-committee-${variant}`, (utils, opts) =>
    defaultProposalBuilder(utils, { ...opts, variant }),
  );
};