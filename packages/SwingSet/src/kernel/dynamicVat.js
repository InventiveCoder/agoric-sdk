import { importBundle } from '@agoric/import-bundle';
import { makeVatSlot } from '../parseVatSlots';
import { makeLiveSlots } from './liveSlots';

export function makeVatRootObjectSlot() {
  return makeVatSlot('object', true, 0);
}

export function makeDynamicVatCreator(stuff) {
  const {
    allocateUnusedVatID,
    vatNameToID,
    makeVatEndowments,
    dynamicVatPowers,
    transformMetering,
    makeGetMeter,
    addVatManager,
    addExport,
    queueToExport,
  } = stuff;

  /** A function to be called from the vatAdmin device to create a new vat. It
   * creates the vat and sends a notification to the device. The root object
   * will be available soon, but we immediately return the vatID so the ultimate
   * requestor doesn't have to wait.
   *
   * @param vatSourceBundle a source bundle (JSON-serializable data) which
   * defines the vat. This should be generated by calling bundle-source on a
   * module whose default export is makeRootObject(), which takes E as a
   * parameter and returns a root object.
   *
   * @return { vatID } the vatID for a newly created vat. The success or
   * failure of the operation will be reported in a message to the admin vat,
   * citing this vatID
   */

  function createVatDynamically(vatSourceBundle) {
    const vatID = allocateUnusedVatID();

    // fail-stop: we refill the meter after each crank (in vatManager
    // doProcess()), but if the vat exhausts its meter within a single crank,
    // it will never run again. We set refillEachCrank:false because we want
    // doProcess to do the refilling itself, so it can count the usage
    const meterRecord = makeGetMeter({
      refillEachCrank: false,
      refillIfExhausted: false,
    });

    let terminated = false;

    function notifyTermination(error) {
      if (terminated) {
        return;
      }
      terminated = true;
      const vatAdminVatId = vatNameToID('vatAdmin');
      const vatAdminRootObjectSlot = makeVatRootObjectSlot();

      const args = {
        body: JSON.stringify([
          vatID,
          error
            ? { '@qclass': 'error', name: error.name, message: error.message }
            : { '@qclass': 'undefined' },
        ]),
        slots: [],
      };

      queueToExport(
        vatAdminVatId,
        vatAdminRootObjectSlot,
        'vatTerminated',
        args,
        'logFailure',
      );
    }

    async function makeBuildRootObject() {
      if (typeof vatSourceBundle !== 'object') {
        throw Error(
          `createVatDynamically() requires bundle, not a plain string`,
        );
      }
      const getMeter = meterRecord.getMeter;
      const inescapableTransforms = [src => transformMetering(src, getMeter)];
      const inescapableGlobalLexicals = { getMeter };

      const vatNS = await importBundle(vatSourceBundle, {
        filePrefix: vatID,
        endowments: makeVatEndowments(vatID),
        inescapableTransforms,
        inescapableGlobalLexicals,
      });
      if (typeof vatNS.buildRootObject !== 'function') {
        throw Error(
          `vat source bundle does not export buildRootObject function`,
        );
      }
      return vatNS.buildRootObject;
    }

    function makeVatManager(buildRootObject) {
      function setup(syscall, state, helpers, _vatPowers) {
        return makeLiveSlots(
          syscall,
          state,
          buildRootObject,
          helpers.vatID,
          dynamicVatPowers,
        );
      }
      addVatManager(
        vatID,
        `dynamicVat${vatID}`,
        setup,
        {},
        meterRecord,
        notifyTermination,
      );
    }

    function makeSuccessResponse() {
      // build success message, giving admin vat access to the new vat's root
      // object
      const kernelRootObjSlot = addExport(vatID, makeVatRootObjectSlot());

      return {
        body: JSON.stringify([
          vatID,
          { rootObject: { '@qclass': 'slot', index: 0 } },
        ]),
        slots: [kernelRootObjSlot],
      };
    }

    function makeErrorResponse(error) {
      return {
        body: JSON.stringify([vatID, { error: `${error}` }]),
        slots: [],
      };
    }

    function sendResponse(args) {
      const vatAdminVatId = vatNameToID('vatAdmin');
      const vatAdminRootObjectSlot = makeVatRootObjectSlot();
      queueToExport(
        vatAdminVatId,
        vatAdminRootObjectSlot,
        'newVatCallback',
        args,
        'logFailure',
      );
    }

    // importBundle is async, so we prepare a callback chain to execute the
    // resulting setup function, create the new vat around the resulting
    // dispatch object, and notify the admin vat of our success (or failure).
    // We presume that importBundle's Promise will fire promptly (before
    // setImmediate does, i.e. importBundle is async but doesn't do any IO,
    // so it doesn't really need to be async), because otherwise the
    // queueToExport might fire (and insert messages into the kernel run
    // queue) in the middle of some other vat's crank. TODO: find a safer
    // way, maybe the response should go out to the controller's "queue
    // things single file into the kernel" queue, once such a thing exists.
    Promise.resolve()
      .then(makeBuildRootObject)
      .then(makeVatManager)
      .then(makeSuccessResponse, makeErrorResponse)
      .then(sendResponse)
      .catch(err => console.error(`error in createVatDynamically`, err));
    // and we return the vatID right away, so the the admin vat can prepare
    // for the notification
    return vatID;
  }

  return createVatDynamically;
}
