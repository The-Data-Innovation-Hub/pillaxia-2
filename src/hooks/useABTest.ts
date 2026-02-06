import { db } from "@/integrations/db";

interface ABTestResult {
  testId: string;
  variant: "A" | "B";
  subject: string;
  preview: string | null;
}

interface ABTestRecord {
  id: string;
  variant_a_subject: string;
  variant_b_subject: string;
  variant_a_preview: string | null;
  variant_b_preview: string | null;
}

interface ABAssignmentRecord {
  variant: string;
}

/**
 * Gets the A/B test variant for a user and notification type.
 * Assigns users consistently to the same variant using their user ID.
 */
export async function getABTestVariant(
  userId: string,
  notificationType: string
): Promise<ABTestResult | null> {
  try {
    // Get active test for this notification type
    const { data: testData, error: testError } = await db
      .from("email_ab_tests" as any)
      .select("*")
      .eq("notification_type", notificationType)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (testError || !testData) {
      return null;
    }

    const test = testData as unknown as ABTestRecord;

    // Check if user already has an assignment for this test
    const { data: assignmentData } = await db
      .from("email_ab_assignments" as any)
      .select("variant")
      .eq("test_id", test.id)
      .eq("user_id", userId)
      .maybeSingle();

    let variant: "A" | "B";

    if (assignmentData) {
      const assignment = assignmentData as unknown as ABAssignmentRecord;
      variant = assignment.variant as "A" | "B";
    } else {
      // Assign based on user ID hash for consistent assignment
      // Simple hash: sum of char codes mod 2
      const hash = userId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
      variant = hash % 2 === 0 ? "A" : "B";
    }

    return {
      testId: test.id,
      variant,
      subject: variant === "A" ? test.variant_a_subject : test.variant_b_subject,
      preview: variant === "A" ? test.variant_a_preview : test.variant_b_preview,
    };
  } catch (error) {
    console.error("Error getting A/B test variant:", error);
    return null;
  }
}

/**
 * Records an A/B test assignment when an email is sent.
 */
export async function recordABTestAssignment(
  testId: string,
  userId: string,
  variant: "A" | "B",
  notificationId: string
): Promise<void> {
  try {
    await db.from("email_ab_assignments" as any).insert({
      test_id: testId,
      user_id: userId,
      variant,
      notification_id: notificationId,
    } as any);
  } catch (error) {
    console.error("Error recording A/B test assignment:", error);
  }
}
